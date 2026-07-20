import { Composer } from 'grammy';
import { detectPlatform, getPlatformName, extractUrls } from '../../utils/helpers.js';
import { getLogger } from '../../services/logger/index.js';

const logger = getLogger({ module: 'downloader' });
const bot = new Composer();

// Cobalt API configuration
const COBALT_API = process.env.COBALT_API_URL || 'https://api.cobalt.tools';
const COBALT_API_KEY = process.env.COBALT_API_KEY;

interface CobaltResponse {
  status: string;
  url?: string;
  filename?: string;
  mimeType?: string;
  fileSize?: number;
  error?: { code: string; message: string };
}

// Download command
bot.command('download', async (ctx) => {
  const messageText = ctx.message?.text || '';
  const urls = extractUrls(messageText);
  
  if (urls.length === 0) {
    await ctx.reply(
      '📥 **Media Downloader**\n\n' +
      'Send me a URL to download from:\n\n' +
      ' Supported platforms:\n' +
      '• YouTube\n• Instagram\n• TikTok\n• Twitter/X\n' +
      '• Reddit\n• Facebook\n• SoundCloud\n• Pinterest\n\n' +
      'Usage: `/download <url>`\n' +
      'Or just send a URL directly!',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  await handleDownload(ctx, urls[0]);
});

// Handle URL messages (any message containing a URL)
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  const urls = extractUrls(text);
  
  if (urls.length > 0 && !text.startsWith('/')) {
    // Check if it looks like a download request
    const platform = detectPlatform(urls[0]);
    if (platform) {
      await handleDownload(ctx, urls[0]);
    }
  }
});

// Callback queries for download options
bot.callback_query(/^download:(.+)$/, async (ctx) => {
  const action = ctx.match[1];
  const data = JSON.parse(ctx.callbackQuery.data.split(':').slice(1).join(':') || '{}');
  
  if (action === 'video' || action === 'audio') {
    await ctx.answerCallbackQuery();
    // Handle quality/format selection
    // This would trigger the actual download with the selected format
    await ctx.reply(`⏳ Processing ${action} download...`);
  }
});

async function handleDownload(ctx: any, url: string) {
  const platform = detectPlatform(url);
  
  if (!platform) {
    await ctx.reply('❌ Unsupported platform or invalid URL.');
    return;
  }
  
  const statusMessage = await ctx.reply(
    `📥 Detected: **${getPlatformName(platform.platform)}**\n\n` +
    `⏳ Fetching media information...`,
    { parse_mode: 'Markdown' }
  );
  
  try {
    // Call Cobalt API
    const response = await fetch(`${COBALT_API}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(COBALT_API_KEY ? { 'Authorization': `Bearer ${COBALT_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        url: url,
        downloadMode: 'auto',
        videoQuality: '1080',
        audioFormat: 'mp3',
        filenameStyle: 'pretty',
      }),
    });
    
    const result: CobaltResponse = await response.json();
    
    if (result.status === 'error' || !result.url) {
      const errorMsg = result.error?.message || 'Failed to fetch media';
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        `❌ **Error**\n\n${errorMsg}`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    // Send download link
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      `✅ **Media Ready**\n\n` +
      `📌 Platform: ${getPlatformName(platform.platform)}\n` +
      `📄 File: ${result.filename || 'download'}\n` +
      `📦 Size: ${result.fileSize ? formatFileSize(result.fileSize) : 'Unknown'}\n\n` +
      `⬇️ [Download Now](${result.url})\n\n` +
      `_Link expires in 15 minutes_`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '⬇️ Download', url: result.url },
            ],
            [
              { text: '📥 Download as Audio', callback_data: `download:audio:${url}` },
            ],
          ],
        },
      }
    );
    
    // Log download
    const db = (ctx as any).db;
    if (db) {
      await db.addDownload(ctx.from.id, url, platform.platform, result.filename || 'unknown');
    }
    
    logger.info('Download completed', {
      userId: ctx.from.id,
      platform: platform.platform,
      url,
    });
    
  } catch (error) {
    logger.error('Download failed', error as Error, { url });
    
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      `❌ **Download Failed**\n\n` +
      `An error occurred while processing your request.\n` +
      `Please try again later.`,
      { parse_mode: 'Markdown' }
    );
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default bot;
