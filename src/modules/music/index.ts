import { Composer } from 'grammy';
import { deezerApi, musicbrainzApi } from '../../services/api/index.js';
import { getLogger } from '../../services/logger/index.js';
import { truncate, formatDuration } from '../../utils/helpers.js';

const logger = getLogger({ module: 'music' });
const bot = new Composer();

// Music search command
bot.command('music', async (ctx) => {
  const query = ctx.message?.text?.replace(/^\/music\s*/, '').trim();
  
  if (!query) {
    await ctx.reply(
      '🎵 **Music Search**\n\n' +
      'Search for songs, artists, or albums:\n\n' +
      'Usage:\n' +
      '`/music <song name>` - Search for a song\n' +
      '`/artist <artist name>` - Artist info\n' +
      '`/album <album name>` - Album info\n\n' +
      'Example: `/music Bohemian Rhapsody`',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  await searchMusic(ctx, query);
});

// Artist info command
bot.command('artist', async (ctx) => {
  const query = ctx.message?.text?.replace(/^\/artist\s*/, '').trim();
  
  if (!query) {
    await ctx.reply('Usage: `/artist <artist name>`', { parse_mode: 'Markdown' });
    return;
  }
  
  await getArtistInfo(ctx, query);
});

// Album info command
bot.command('album', async (ctx) => {
  const query = ctx.message?.text?.replace(/^\/album\s*/, '').trim();
  
  if (!query) {
    await ctx.reply('Usage: `/album <album name>`', { parse_mode: 'Markdown' });
    return;
  }
  
  await getAlbumInfo(ctx, query);
});

// Handle music-related callback queries
bot.callback_query(/^music:(.+)$/, async (ctx) => {
  const action = ctx.match[1];
  await ctx.answerCallbackQuery();
  
  // Handle different music actions
  if (action.startsWith('preview:')) {
    const trackId = action.replace('preview:', '');
    // Send audio preview
    await ctx.reply(`🎵 Loading preview for track ${trackId}...`);
  }
});

async function searchMusic(ctx: any, query: string) {
  const statusMessage = await ctx.reply(`🔍 Searching for "${query}"...`);
  
  try {
    // Search Deezer
    const results = await deezerApi.get<{ data: any[] }>('/search', { q: query, limit: 5 });
    
    if (!results.data || results.data.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        `❌ No results found for "${query}"`
      );
      return;
    }
    
    const tracks = results.data.map((track, index) => {
      return `${index + 1}. **${track.title}**\n` +
             `   🎤 ${track.artist.name}\n` +
             `   💿 ${track.album.title}\n` +
             `   ⏱ ${formatDuration(track.duration)}`;
    }).join('\n\n');
    
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      `🎵 **Search Results for "${query}"**\n\n${tracks}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: results.data.map((track, index) => [
            {
              text: `${index + 1}. ${truncate(track.title, 20)}`,
              callback_data: `music:track:${track.id}`,
            },
          ]),
        },
      }
    );
    
    logger.info('Music search completed', { query, results: results.data.length });
    
  } catch (error) {
    logger.error('Music search failed', error as Error, { query });
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      '❌ Music search failed. Please try again.'
    );
  }
}

async function getArtistInfo(ctx: any, query: string) {
  const statusMessage = await ctx.reply(`🔍 Searching for artist "${query}"...`);
  
  try {
    // Search Deezer for artist
    const searchResults = await deezerApi.get<{ data: any[] }>('/search/artist', { q: query, limit: 1 });
    
    if (!searchResults.data || searchResults.data.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        `❌ Artist "${query}" not found`
      );
      return;
    }
    
    const artistId = searchResults.data[0].id;
    const artist = await deezerApi.get<any>(`/artist/${artistId}`);
    
    const message = 
      `🎤 **${artist.name}**\n\n` +
      `📊 Fans: ${artist.nb_fan?.toLocaleString() || 'N/A'}\n` +
      `💿 Albums: ${artist.nb_album || 'N/A'}\n` +
      `🔗 [Deezer](${artist.link})`;
    
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      message,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🎵 Top Tracks', callback_data: `music:artist_top:${artistId}` },
              { text: '💿 Discography', callback_data: `music:artist_albums:${artistId}` },
            ],
          ],
        },
      }
    );
    
  } catch (error) {
    logger.error('Artist search failed', error as Error, { query });
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      '❌ Artist search failed. Please try again.'
    );
  }
}

async function getAlbumInfo(ctx: any, query: string) {
  const statusMessage = await ctx.reply(`🔍 Searching for album "${query}"...`);
  
  try {
    // Search Deezer for album
    const searchResults = await deezerApi.get<{ data: any[] }>('/search/album', { q: query, limit: 1 });
    
    if (!searchResults.data || searchResults.data.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        `❌ Album "${query}" not found`
      );
      return;
    }
    
    const albumId = searchResults.data[0].id;
    const album = await deezerApi.get<any>(`/album/${albumId}`);
    
    const tracks = album.tracks?.data?.map((track: any, i: number) => 
      `${i + 1}. ${track.title} (${formatDuration(track.duration)})`
    ).join('\n') || 'No tracks available';
    
    const message = 
      `💿 **${album.title}**\n\n` +
      `🎤 Artist: ${album.artist.name}\n` +
      `📅 Released: ${album.release_date}\n` +
      `🎵 Tracks: ${album.nb_tracks}\n\n` +
      `**Tracklist:**\n${tracks}`;
    
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      message,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔗 Listen on Deezer', url: album.link },
            ],
          ],
        },
      }
    );
    
  } catch (error) {
    logger.error('Album search failed', error as Error, { query });
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      '❌ Album search failed. Please try again.'
    );
  }
}

export default bot;
