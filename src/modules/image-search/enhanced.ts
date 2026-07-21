import { Composer, type Context } from 'grammy';
import { searchImages, type ImageSearchResponse } from '../../services/image-search/index.js';
import { getLogger } from '../../services/logger/index.js';
import { truncate } from '../../utils/helpers.js';
import type { Env } from '../../types/env.js';
import type { FeatureFlags } from '../../services/feature-flags/index.js';
import type { IkolModule } from '../../bot/plugin-system.js';
import { registerModule } from '../../bot/plugin-system.js';
import type { ImageSearchResult } from '../../services/image-search/types.js';

const logger = getLogger({ module: 'image-search' });

const RESULTS_PER_PAGE = 10;
const SESSION_CACHE = new Map<string, {
  results: ImageSearchResult[];
  query: string;
  provider: string;
  timestamp: number;
}>();

const SESSION_TTL = 30 * 60 * 1000;

function getSessionKey(chatId: number, query: string): string {
  return `${chatId}:${query.toLowerCase().trim()}`;
}

function getCachedSession(chatId: number, query: string) {
  const key = getSessionKey(chatId, query);
  const session = SESSION_CACHE.get(key);

  if (!session) return null;
  if (Date.now() - session.timestamp > SESSION_TTL) {
    SESSION_CACHE.delete(key);
    return null;
  }

  return session;
}

function setCachedSession(chatId: number, query: string, data: {
  results: ImageSearchResult[];
  provider: string;
}) {
  const key = getSessionKey(chatId, query);
  SESSION_CACHE.set(key, {
    results: data.results,
    query,
    provider: data.provider,
    timestamp: Date.now(),
  });
}

function buildResultsMessage(
  results: ImageSearchResult[],
  page: number,
  query: string,
  provider: string
): string {
  const total = results.length;
  const start = (page - 1) * RESULTS_PER_PAGE;
  const end = Math.min(start + RESULTS_PER_PAGE, total);
  const totalPages = Math.ceil(total / RESULTS_PER_PAGE);

  let message = `🖼 Image Results ${start + 1}-${end} / ${total}\n`;
  message += `Query: ${query}\n`;
  message += `Provider: ${provider}\n\n`;

  const pageResults = results.slice(start, end);
  pageResults.forEach((r, i) => {
    const num = start + i + 1;
    message += `${num}. ${truncate(r.title, 40)}\n`;
  });

  message += `\nPage ${page}/${totalPages}`;

  return message;
}

function buildInlineKeyboard(
  results: ImageSearchResult[],
  page: number,
  query: string
): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } {
  const totalPages = Math.ceil(results.length / RESULTS_PER_PAGE);
  const queryHash = encodeURIComponent(query.slice(0, 30));

  const row1: Array<{ text: string; callback_data: string }> = [];

  if (page > 1) {
    row1.push({
      text: '⬅ Previous',
      callback_data: `img:page:${queryHash}:${page - 1}`,
    });
  }

  row1.push({
    text: `Page ${page}/${totalPages}`,
    callback_data: 'img:noop',
  });

  if (page < totalPages) {
    row1.push({
      text: '➡ Next',
      callback_data: `img:page:${queryHash}:${page + 1}`,
    });
  }

  const row2: Array<{ text: string; callback_data: string }> = [
    {
      text: '🔄 Refresh',
      callback_data: `img:refresh:${queryHash}`,
    },
  ];

  if (results.length > 0) {
    const startIndex = (page - 1) * RESULTS_PER_PAGE;
    const firstResult = results[startIndex];
    if (firstResult?.sourceUrl) {
      row2.push({
        text: '🌐 Source',
        callback_data: `img:source:${startIndex}`,
      });
    }
  }

  return { inline_keyboard: [row1, row2] };
}

async function performSearch(
  ctx: any,
  query: string,
  page: number = 1
) {
  const statusMessage = await ctx.reply(`🔎 Searching images for "${query}"...`);
  const startTime = Date.now();

  try {
    const env = ctx.env;
    const response: ImageSearchResponse = await searchImages(query, {
      query,
      page: 1,
      limit: 50,
      safeSearch: true,
    }, env);

    if (!response.results || response.results.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        `No images found for "${query}"`
      );
      return;
    }

    setCachedSession(ctx.chat.id, query, {
      results: response.results,
      provider: response.provider,
    });

    const message = buildResultsMessage(
      response.results,
      page,
      query,
      response.provider
    );

    const keyboard = buildInlineKeyboard(response.results, page, query);

    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      message,
      { reply_markup: keyboard }
    );

    logger.info('Image search displayed', {
      module: 'image-search',
      provider: response.provider,
      latency: Date.now() - startTime,
      resultCount: response.results.length,
    });
  } catch (error) {
    logger.error('Image search failed', {
      module: 'image-search',
      status: 'error',
      latency: Date.now() - startTime,
      error: (error as Error).message,
    });

    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      `Image search failed: ${(error as Error).message}`
    );
  }
}

async function handlePageCallback(
  ctx: any,
  queryHash: string,
  page: number
) {
  await ctx.answerCallbackQuery();

  const session = findSessionByHash(ctx.chat.id, queryHash);
  if (!session) {
    await ctx.reply('Session expired. Please search again.');
    return;
  }

  const message = buildResultsMessage(
    session.results,
    page,
    session.query,
    session.provider
  );

  const keyboard = buildInlineKeyboard(session.results, page, session.query);

  try {
    await ctx.editMessageText(message, { reply_markup: keyboard });
  } catch {
    await ctx.reply('Failed to update. Please search again.');
  }
}

function findSessionByHash(chatId: number, queryHash: string) {
  for (const [key, session] of SESSION_CACHE.entries()) {
    if (!key.startsWith(`${chatId}:`)) continue;

    const hash = encodeURIComponent(session.query.slice(0, 30));
    if (hash === queryHash) {
      return session;
    }
  }
  return null;
}

function createImageSearchModule(): IkolModule {
  return {
    name: 'image-search',
    featureFlag: 'imageSearch',
    version: '1.0.0',
    register(composer: Composer<Context>, env: Env, flags: FeatureFlags) {
      composer.command('image', async (ctx) => {
        const query = ctx.message?.text?.replace(/^\/image\s*/, '').trim();
        if (!query) {
          await ctx.reply(
            'Image Search\n\n' +
            'Search for images across multiple providers:\n\n' +
            'Usage:\n' +
            '/image <query> - Search images\n\n' +
            'Examples:\n' +
            '/image cyberpunk room\n' +
            '/image mountain landscape\n' +
            '/image abstract art\n\n' +
            'Providers: Pinterest, Pexels, Pixabay, Unsplash, Wikimedia'
          );
          return;
        }
        await performSearch(ctx, query);
      });

      composer.command('pin', async (ctx) => {
        const query = ctx.message?.text?.replace(/^\/pin\s*/, '').trim();
        if (!query) {
          await ctx.reply(
            'Pinterest Image Search\n\n' +
            'Search for images via Pinterest:\n\n' +
            'Usage:\n' +
            '/pin <query> - Search images\n\n' +
            'Examples:\n' +
            '/pin cyberpunk room\n' +
            '/pin aesthetic wallpaper'
          );
          return;
        }
        await performSearch(ctx, query);
      });

      composer.callbackQuery(/^img:page:([^:]+):(\d+)$/, async (ctx) => {
        const queryHash = decodeURIComponent(ctx.match[1]);
        const page = parseInt(ctx.match[2], 10);
        await handlePageCallback(ctx, queryHash, page);
      });

      composer.callbackQuery(/^img:refresh:([^:]+)$/, async (ctx) => {
        const queryHash = decodeURIComponent(ctx.match[1]);
        await ctx.answerCallbackQuery();

        if (!ctx.chat) {
          await ctx.reply('Session expired. Please search again.');
          return;
        }

        const session = findSessionByHash(ctx.chat.id, queryHash);
        if (!session) {
          await ctx.reply('Session expired. Please search again.');
          return;
        }

        await performSearch(ctx, session.query);
      });

      composer.callbackQuery('img:noop', async (ctx) => {
        await ctx.answerCallbackQuery();
      });

      composer.callbackQuery(/^img:source:(\d+)$/, async (ctx) => {
        await ctx.answerCallbackQuery();
        const index = parseInt(ctx.match[1], 10);

        const session = findSessionByHash(ctx.chat?.id || 0, '');
        if (session && session.results[index]?.sourceUrl) {
          await ctx.reply(session.results[index].sourceUrl);
        }
      });
    },
  };
}

registerModule(createImageSearchModule());

const bot = new Composer<Context>();
export default bot;
