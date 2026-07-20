import { Composer } from 'grammy';
import { detectPlatform, getPlatformName, extractUrls, formatFileSize } from '../../utils/helpers.js';
import { downloadMedia } from '../../services/providers/downloader.js';
import { getLogger } from '../../services/logger/index.js';

const logger = getLogger({ module: 'downloader-enhanced' });
const bot = new Composer();

// Enhanced download command with progress
bot.command('download', async (ctx) => {
  const messageText = ctx.message?.text || '';
  const urls = extractUrls(messageText);

  if (urls.length === 0) {
    await ctx.reply(
      '📥 **Universal Downloader**\n\n' +
      'Send me a URL to download from:\n\n' +
      '**Supported Platforms:**\n' +
      '• YouTube\n• Instagram\n• TikTok\n• Twitter/X\n' +
      '• Reddit\n• Facebook\n• SoundCloud\n• Pinterest\n' +
      '• Vimeo\n• And many more!\n\n' +
      'Usage: `/download <url>`\n' +
      'Or just send a URL directly!\n\n' +
      '**Options:**\n' +
      '• Send URL alone for video\n' +
      '• `/download audio <url>` for audio only',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Check for audio option
  const isAudio = messageText.toLowerCase().includes('audio');
  await handleEnhancedDownload(ctx, urls[0], { format: isAudio ? 'audio' : 'video' });
});

// Handle URL messages
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  const urls = extractUrls(text);

  if (urls.length > 0 && !text.startsWith('/')) {
    const platform = detectPlatform(urls[0]);
    if (platform) {
      await handleEnhancedDownload(ctx, urls[0]);
    }
  }
});

// Enhanced download handler with multiple fallbacks
async function handleEnhancedDownload(
  ctx: any,
  url: string,
  options: { format?: 'video' | 'audio'; quality?: string } = {}
) {
  const platform = detectPlatform(url);

  if (!platform) {
    await ctx.reply('❌ Unsupported platform or invalid URL.');
    return;
  }

  // Send processing message with platform info
  const statusMessage = await ctx.reply(
    `📥 **Processing Download**\n\n` +
    `🌐 Platform: **${getPlatformName(platform.platform)}**\n` +
    `⏳ Fetching media information...`,
    { parse_mode: 'Markdown' }
  );

  const startTime = Date.now();

  try {
    // Try download with fallback chain
    const result = await downloadMedia(url, options);

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);

    // Build response message
    let message = 
      `✅ **Download Ready**\n\n` +
      `🌐 Platform: **${getPlatformName(result.platform)}**\n` +
      `📄 File: ${result.filename}\n`;

    if (result.size) {
      message += `📦 Size: ${formatFileSize(result.size)}\n`;
    }

    if (result.quality) {
      message += `🎬 Quality: ${result.quality}\n`;
    }

    message += 
      `⚡ Processing: ${processingTime}s\n\n` +
      `⬇️ [Download Now](${result.url})\n\n` +
      `_Link expires in 15 minutes_`;

    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      message,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '⬇️ Download', url: result.url },
            ],
            [
              { 
                text: options.format === 'audio' ? '🎬 Get Video' : '🎵 Get Audio',
                callback_data: `download:${options.format === 'audio' ? 'video' : 'audio'}:${url}`,
              },
            ],
          ],
        },
      }
    );

    // Log download
    const db = (ctx as any).db;
    if (db) {
      await db.addDownload(ctx.from.id, url, result.platform, result.filename);
    }

    logger.info('Download completed', {
      userId: ctx.from.id,
      platform: result.platform,
      processingTime,
    });

  } catch (error) {
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.error('Download failed', error as Error, { url, processingTime });

    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      `❌ **Download Failed**\n\n` +
      `🌐 Platform: **${getPlatformName(platform.platform)}**\n` +
      `⏱ Time: ${processingTime}s\n\n` +
      `**Error:** ${(error as Error).message}\n\n` +
      `**Suggestions:**\n` +
      `• Check if the URL is valid\n` +
      `• Try a different quality option\n` +
      `• The content may be restricted`,
      { parse_mode: 'Markdown' }
    );
  }
}

// Handle download callback queries
bot.callbackQuery(/^download:(audio|video):(.+)$/, async (ctx) => {
  const format = ctx.match[1] as 'audio' | 'video';
  const url = ctx.match[2];

  await ctx.answerCallbackQuery();
  await handleEnhancedDownload(ctx, url, { format });
});

export default bot;
