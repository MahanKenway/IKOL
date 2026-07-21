import { Composer, type Context } from 'grammy';
import { detectPlatform, getPlatformName, extractUrls, formatFileSize } from '../../utils/helpers.js';
import { downloadMedia } from '../../services/providers/downloader.js';
import { getLogger } from '../../services/logger/index.js';
import type { Env } from '../../types/env.js';
import type { FeatureFlags } from '../../services/feature-flags/index.js';
import type { IkolModule } from '../../bot/plugin-system.js';
import { registerModule } from '../../bot/plugin-system.js';

const logger = getLogger({ module: 'downloader' });

async function handleDownload(
  ctx: any,
  url: string,
  options: { format?: 'video' | 'audio'; quality?: string } = {}
) {
  const platform = detectPlatform(url);

  const statusMessage = await ctx.reply(
    `Processing Download...\nPlatform: ${platform ? getPlatformName(platform.platform) : 'Unknown'}`
  );

  const startTime = Date.now();

  try {
    const env = (ctx as any).env;
    const result = await downloadMedia(url, options, env);
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);

    let message =
      `Download Ready\n\n` +
      `Platform: ${getPlatformName(result.platform)}\n` +
      `File: ${result.filename}\n`;

    if (result.size) message += `Size: ${formatFileSize(result.size)}\n`;
    if (result.quality) message += `Quality: ${result.quality}\n`;

    message += `Time: ${processingTime}s\n\nLink expires in 15 minutes`;

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMessage.message_id,
      message,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Download', url: result.url }],
            [{
              text: options.format === 'audio' ? 'Get Video' : 'Get Audio',
              callback_data: `download:${options.format === 'audio' ? 'video' : 'audio'}:${url}`,
            }],
          ],
        },
      }
    );

    const db = (ctx as any).db;
    if (db) {
      try { await db.addDownload(ctx.from.id, url, result.platform, result.filename); } catch { /* non-critical */ }
    }

    logger.info('Download completed', {
      module: 'downloader',
      provider: result.platform,
      latency: Date.now() - startTime,
      status: 'success',
    });

  } catch (error) {
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMessage.message_id,
      `Download Failed\n\nPlatform: ${platform ? getPlatformName(platform.platform) : 'Unknown'}\n` +
      `Error: ${(error as Error).message}\n\n` +
      `Suggestions:\n- Check if the URL is valid\n- Try a different option\n- Content may be restricted`
    );

    logger.error('Download failed', {
      module: 'downloader',
      status: 'error',
      latency: Date.now() - startTime,
      error: (error as Error).message,
    });
  }
}

function createDownloaderModule(): IkolModule {
  return {
    name: 'downloader',
    featureFlag: 'downloader',
    version: '2.0.0',
    register(composer: Composer<Context>, env: Env, flags: FeatureFlags) {
      composer.command('download', async (ctx) => {
        const messageText = ctx.message?.text || '';
        const urls = extractUrls(messageText);

        if (urls.length === 0) {
          await ctx.reply(
            'Universal Downloader\n\n' +
            'Send me a URL to download from:\n\n' +
            'Supported Platforms:\n' +
            'YouTube, Instagram, TikTok, Twitter/X,\n' +
            'Reddit, Facebook, SoundCloud, Pinterest\n\n' +
            'Usage: /download <url>\n' +
            'Or just send a URL directly!\n\n' +
            'Options:\n' +
            '/download audio <url> for audio only'
          );
          return;
        }

        const isAudio = messageText.toLowerCase().includes('audio');
        await handleDownload(ctx, urls[0], { format: isAudio ? 'audio' : 'video' });
      });

      // Handle URL messages
      composer.on('message:text', async (ctx, next) => {
        const text = ctx.message.text;
        if (text.startsWith('/')) {
          await next();
          return;
        }

        const urls = extractUrls(text);

        if (urls.length > 0) {
          const platform = detectPlatform(urls[0]);
          if (platform) {
            await handleDownload(ctx, urls[0]);
            return;
          }
        }

        await next();
      });

      composer.callbackQuery(/^download:(audio|video):(.+)$/, async (ctx) => {
        const format = ctx.match[1] as 'audio' | 'video';
        const url = ctx.match[2];
        await ctx.answerCallbackQuery();
        await handleDownload(ctx, url, { format });
      });
    },
  };
}

registerModule(createDownloaderModule());

const bot = new Composer<Context>();
export default bot;



