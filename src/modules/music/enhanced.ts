import { Composer } from 'grammy';
import { searchMusic } from '../../services/providers/music.js';
import { getLyrics } from '../../services/providers/lyrics.js';
import { getLogger } from '../../services/logger/index.js';
import { truncate, formatDuration } from '../../utils/helpers.js';

const logger = getLogger({ module: 'music-enhanced' });
const bot = new Composer();

// Enhanced music search with lyrics support
bot.command('music', async (ctx) => {
  const query = ctx.message?.text?.replace(/^\/music\s*/, '').trim();

  if (!query) {
    await ctx.reply(
      '🎵 **Music Search**\n\n' +
      'Search for songs, artists, or albums:\n\n' +
      'Usage:\n' +
      '`/music <song name>` - Search for a song\n' +
      '`/lyrics <song name>` - Get lyrics\n' +
      '`/artist <artist name>` - Artist info\n' +
      '`/album <album name>` - Album info\n\n' +
      'Example: `/music Bohemian Rhapsody`',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  await searchAndDisplayMusic(ctx, query);
});

// Lyrics command
bot.command('lyrics', async (ctx) => {
  const query = ctx.message?.text?.replace(/^\/lyrics\s*/, '').trim();

  if (!query) {
    await ctx.reply(
      '📝 **Lyrics Search**\n\n' +
      'Usage: `/lyrics <song name>`\n\n' +
      'Example: `/lyrics Bohemian Rhapsody`',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  await fetchAndDisplayLyrics(ctx, query);
});

// Handle music callback queries
bot.callbackQuery(/^music:(.+)$/, async (ctx) => {
  const action = ctx.match[1];
  await ctx.answerCallbackQuery();

  if (action.startsWith('lyrics:')) {
    const trackId = action.replace('lyrics:', '');
    await fetchLyricsById(ctx, trackId);
  }
});

// Search and display music results
async function searchAndDisplayMusic(ctx: any, query: string) {
  const statusMessage = await ctx.reply(`🔍 Searching for "${query}"...`);

  try {
    const { results, source } = await searchMusic(query, 5);

    if (!results || results.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        `❌ No results found for "${query}"`
      );
      return;
    }

    const tracks = results.map((track, index) => {
      return `${index + 1}. **${track.title}**\n` +
             `   🎤 ${track.artist}\n` +
             (track.album ? `   💿 ${track.album}\n` : '') +
             (track.duration ? `   ⏱ ${formatDuration(track.duration)}\n` : '') +
             `   📡 Source: ${track.platform}`;
    }).join('\n\n');

    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      `🎵 **Search Results for "${query}"**\n\n${tracks}\n\n_Source: ${source}_`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            ...results.map((track, index) => [
              {
                text: `${index + 1}. ${truncate(track.title, 20)}`,
                callback_data: `music:track:${track.id}`,
              },
            ]),
            [
              { text: '📝 Get Lyrics', callback_data: `music:lyrics:${encodeURIComponent(query)}` },
            ],
          ],
        },
      }
    );

    logger.info('Music search completed', { query, results: results.length, source });

  } catch (error) {
    logger.error('Music search failed', error as Error, { query });
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      '❌ Music search failed. Please try again.'
    );
  }
}

// Fetch and display lyrics
async function fetchAndDisplayLyrics(ctx: any, query: string) {
  const statusMessage = await ctx.reply(`📝 Fetching lyrics for "${query}"...`);

  try {
    // Parse query - try to extract artist and title
    const parts = query.split(' - ');
    const artist = parts.length > 1 ? parts[0].trim() : undefined;
    const title = parts.length > 1 ? parts[1].trim() : query;

    const lyrics = await getLyrics(artist || '', title);

    if (!lyrics || (!lyrics.plainLyrics && !lyrics.syncedLyrics)) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        `❌ No lyrics found for "${query}"\n\n_Try: /lyrics Artist - Title_`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const lyricsText = lyrics.plainLyrics || lyrics.syncedLyrics || '';
    
    // Truncate if too long for Telegram (4096 chars)
    const truncatedLyrics = lyricsText.length > 3500 
      ? lyricsText.substring(0, 3500) + '\n\n... [Lyrics truncated]'
      : lyricsText;

    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      `📝 **Lyrics: ${query}**\n\n${truncatedLyrics}\n\n_Source: ${lyrics.source}_`,
      { parse_mode: 'Markdown' }
    );

    logger.info('Lyrics fetched', { query, source: lyrics.source });

  } catch (error) {
    logger.error('Lyrics fetch failed', error as Error, { query });
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      '❌ Failed to fetch lyrics. Please try again.'
    );
  }
}

// Fetch lyrics by track ID
async function fetchLyricsById(ctx: any, trackId: string) {
  await ctx.reply('📝 Fetching lyrics...');

  try {
    // Parse track ID to get artist/title
    // This is simplified - in production, you'd look up the track
    const lyrics = await getLyrics('', trackId);

    if (lyrics?.plainLyrics) {
      await ctx.reply(`📝 **Lyrics:**\n\n${lyrics.plainLyrics}`, {
        parse_mode: 'Markdown',
      });
    } else {
      await ctx.reply('❌ Lyrics not available for this track.');
    }
  } catch (error) {
    logger.error('Lyrics fetch failed', error as Error, { trackId });
    await ctx.reply('❌ Failed to fetch lyrics.');
  }
}

export default bot;
