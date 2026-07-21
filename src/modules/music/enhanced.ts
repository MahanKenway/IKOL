import { Composer, type Context } from 'grammy';
import { searchMusic, enrichTrackMetadata } from '../../services/providers/music.js';
import { getLyrics } from '../../services/providers/lyrics.js';
import { getLogger } from '../../services/logger/index.js';
import { truncate, formatDuration } from '../../utils/helpers.js';
import type { Env } from '../../types/env.js';
import type { FeatureFlags } from '../../services/feature-flags/index.js';
import type { IkolModule } from '../../bot/plugin-system.js';
import { registerModule } from '../../bot/plugin-system.js';
import type { MusicSearchResult } from '../../services/providers/index.js';

const logger = getLogger({ module: 'music' });

// Session cache for search results (in-memory, per worker)
const searchSessions = new Map<string, {
  results: MusicSearchResult[];
  query: string;
  source: string;
  timestamp: number;
}>();

const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

function getSessionKey(chatId: number, query: string): string {
  return `${chatId}:${query.toLowerCase().trim()}`;
}

function getCachedSession(chatId: number, query: string) {
  const key = getSessionKey(chatId, query);
  const session = searchSessions.get(key);
  if (!session) return null;
  if (Date.now() - session.timestamp > SESSION_TTL) {
    searchSessions.delete(key);
    return null;
  }
  return session;
}

function setCachedSession(chatId: number, query: string, data: {
  results: MusicSearchResult[];
  source: string;
}) {
  const key = getSessionKey(chatId, query);
  searchSessions.set(key, {
    results: data.results,
    query,
    source: data.source,
    timestamp: Date.now(),
  });
}

function findSessionByHash(chatId: number, queryHash: string) {
  for (const [key, session] of searchSessions.entries()) {
    if (!key.startsWith(`${chatId}:`)) continue;
    const hash = encodeURIComponent(session.query.slice(0, 30));
    if (hash === queryHash) return session;
  }
  return null;
}

function formatDurationShort(seconds: number): string {
  if (!seconds || seconds <= 0) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function buildTrackCard(track: MusicSearchResult, index: number): string {
  const lines: string[] = [];
  lines.push(`${index}. 🎵 ${truncate(track.title, 40)}`);
  lines.push(`🎤 ${truncate(track.artist, 35)}`);
  if (track.album) lines.push(`💿 ${truncate(track.album, 35)}`);
  if (track.duration) lines.push(`⏱ ${formatDurationShort(track.duration)}`);
  if (track.releaseDate) lines.push(`📅 ${track.releaseDate}`);
  if (track.explicit) lines.push(`🔞 Explicit`);
  if (track.qualities && track.qualities.length > 0) {
    const qualityLabels = track.qualities.map(q => q.label).join(' | ');
    lines.push(`🎧 ${qualityLabels}`);
  }
  return lines.join('\n');
}

function buildSearchResultsMessage(
  results: MusicSearchResult[],
  page: number,
  query: string,
  provider: string
): string {
  const total = results.length;
  const start = (page - 1) * 10;
  const end = Math.min(start + 10, total);
  const totalPages = Math.ceil(total / 10);

  let message = `🎵 Music Results ${start + 1}-${end} / ${total}\n`;
  message += `Query: ${query}\n`;
  message += `Provider: ${provider}\n\n`;

  const pageResults = results.slice(start, end);
  pageResults.forEach((track, i) => {
    message += buildTrackCard(track, start + i + 1) + '\n\n';
  });

  return message;
}

function buildInlineKeyboard(
  results: MusicSearchResult[],
  page: number,
  query: string
): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } {
  const totalPages = Math.ceil(results.length / 10);
  const queryHash = encodeURIComponent(query.slice(0, 30));

  const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];

  // Navigation row
  const navRow: Array<{ text: string; callback_data: string }> = [];
  if (page > 1) {
    navRow.push({ text: '⬅ Prev', callback_data: `music:page:${queryHash}:${page - 1}` });
  }
  navRow.push({ text: `${page}/${totalPages}`, callback_data: 'music:noop' });
  if (page < totalPages) {
    navRow.push({ text: 'Next ➡', callback_data: `music:page:${queryHash}:${page + 1}` });
  }
  keyboard.push(navRow);

  // Action row
  keyboard.push([
    { text: '🔄 Refresh', callback_data: `music:refresh:${queryHash}` },
    { text: '📝 Lyrics', callback_data: `music:lyrics:${encodeURIComponent(query)}` },
  ]);

  return { inline_keyboard: keyboard };
}

async function searchAndDisplayMusic(ctx: any, query: string) {
  const statusMessage = await ctx.reply(`🎵 Searching for "${query}"...`);
  const env = ctx.env;
  const start = Date.now();

  try {
    const { results, source } = await searchMusic(query, 50, env);

    if (!results || results.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        `No results found for "${query}"`
      );
      return;
    }

    setCachedSession(ctx.chat.id, query, { results, source });

    const message = buildSearchResultsMessage(results, 1, query, source);
    const keyboard = buildInlineKeyboard(results, 1, query);

    // Try to send with cover art of first result
    const firstTrack = results[0];
    if (firstTrack?.coverUrl) {
      try {
        await ctx.api.deleteMessage(ctx.chat.id, statusMessage.message_id);
        await ctx.api.sendPhoto(ctx.chat.id, firstTrack.coverUrl, {
          caption: message,
          reply_markup: keyboard,
        });
        return;
      } catch {
        // Fall back to text message if photo fails
      }
    }

    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      message,
      { reply_markup: keyboard }
    );

    logger.info('Music search completed', {
      module: 'music',
      provider: source,
      latency: Date.now() - start,
      resultCount: results.length,
      status: 'success',
    });

  } catch (error) {
    logger.error('Music search failed', {
      module: 'music',
      status: 'error',
      latency: Date.now() - start,
      error: (error as Error).message,
    });
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      'Music search failed. Please try again.'
    );
  }
}

async function fetchAndDisplayLyrics(ctx: any, query: string) {
  const statusMessage = await ctx.reply(`📝 Fetching lyrics for "${query}"...`);
  const env = ctx.env;
  const start = Date.now();

  try {
    const parts = query.split(' - ');
    const artist = parts.length > 1 ? parts[0].trim() : '';
    const title = parts.length > 1 ? parts[1].trim() : query;

    if (!artist && !title) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        'Please provide a song name. Example: /lyrics Artist - Title'
      );
      return;
    }

    const lyrics = await getLyrics(artist, title, env);

    if (!lyrics || (!lyrics.plainLyrics && !lyrics.syncedLyrics)) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        `No lyrics found for "${query}"\n\nTip: /lyrics Artist - Title`
      );
      return;
    }

    const lyricsText = lyrics.plainLyrics || lyrics.syncedLyrics || '';
    const header = `📝 Lyrics: ${query}\n\n`;
    const footer = `\n\nSource: ${lyrics.source}`;
    const maxLyricsLength = 4096 - header.length - footer.length;
    const truncatedLyrics = lyricsText.length > maxLyricsLength
      ? lyricsText.substring(0, maxLyricsLength) + '\n\n... [Lyrics truncated]'
      : lyricsText;

    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      `${header}${truncatedLyrics}${footer}`
    );

    logger.info('Lyrics fetched', {
      module: 'music',
      provider: lyrics.source,
      latency: Date.now() - start,
      status: 'success',
    });

  } catch (error) {
    logger.error('Lyrics fetch failed', {
      module: 'music',
      status: 'error',
      latency: Date.now() - start,
      error: (error as Error).message,
    });
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      'Failed to fetch lyrics. Please try again.'
    );
  }
}

function createMusicModule(): IkolModule {
  return {
    name: 'music',
    featureFlag: 'music',
    version: '3.0.0',
    register(composer: Composer<Context>, env: Env, flags: FeatureFlags) {
      composer.command('music', async (ctx) => {
        const query = ctx.message?.text?.replace(/^\/music\s*/, '').trim();
        if (!query) {
          await ctx.reply(
            '🎵 Music Search\n\n' +
            'Search for songs, artists, or albums:\n\n' +
            'Usage:\n' +
            '/music <query> - Search for music\n' +
            '/lyrics <query> - Get lyrics\n\n' +
            'Examples:\n' +
            '/music Linkin Park Numb\n' +
            '/music Bohemian Rhapsody\n' +
            '/music Artist - Title'
          );
          return;
        }
        await searchAndDisplayMusic(ctx, query);
      });

      composer.command('lyrics', async (ctx) => {
        const query = ctx.message?.text?.replace(/^\/lyrics\s*/, '').trim();
        if (!query) {
          await ctx.reply(
            '📝 Lyrics Search\n\n' +
            'Usage: /lyrics <song name>\n\n' +
            'Examples:\n' +
            '/lyrics Bohemian Rhapsody\n' +
            '/lyrics Artist - Title'
          );
          return;
        }
        await fetchAndDisplayLyrics(ctx, query);
      });

      // Pagination
      composer.callbackQuery(/^music:page:([^:]+):(\d+)$/, async (ctx) => {
        const queryHash = decodeURIComponent(ctx.match[1]);
        const page = parseInt(ctx.match[2], 10);
        await ctx.answerCallbackQuery();

        const session = findSessionByHash(ctx.chat?.id || 0, queryHash);
        if (!session) {
          await ctx.reply('Session expired. Please search again.');
          return;
        }

        const message = buildSearchResultsMessage(session.results, page, session.query, session.source);
        const keyboard = buildInlineKeyboard(session.results, page, session.query);

        try {
          await ctx.editMessageText(message, { reply_markup: keyboard });
        } catch {
          await ctx.reply('Failed to update. Please search again.');
        }
      });

      // Refresh
      composer.callbackQuery(/^music:refresh:([^:]+)$/, async (ctx) => {
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

        await searchAndDisplayMusic(ctx, session.query);
      });

      // Lyrics from button
      composer.callbackQuery(/^music:lyrics:(.+)$/, async (ctx) => {
        const query = decodeURIComponent(ctx.match[1]);
        await ctx.answerCallbackQuery();
        await fetchAndDisplayLyrics(ctx, query);
      });

      // Noop
      composer.callbackQuery('music:noop', async (ctx) => {
        await ctx.answerCallbackQuery();
      });

      // Track selection (future: show track details with cover)
      composer.callbackQuery(/^music:track:(.+)$/, async (ctx) => {
        const trackId = ctx.match[1];
        await ctx.answerCallbackQuery();

        // Find track in session
        for (const [, session] of searchSessions.entries()) {
          const track = session.results.find(t => t.id === trackId);
          if (track) {
            let detail = `🎵 ${track.title}\n🎤 ${track.artist}`;
            if (track.album) detail += `\n💿 ${track.album}`;
            if (track.duration) detail += `\n⏱ ${formatDurationShort(track.duration)}`;
            if (track.sourceUrl) detail += `\n\n🔗 ${track.sourceUrl}`;

            if (track.coverUrl) {
              try {
                await ctx.replyWithPhoto(track.coverUrl, { caption: detail });
                return;
              } catch {
                await ctx.reply(detail);
                return;
              }
            }

            await ctx.reply(detail);
            return;
          }
        }

        await ctx.reply('Track not found in session.');
      });
    },
  };
}

registerModule(createMusicModule());

const bot = new Composer<Context>();
export default bot;
