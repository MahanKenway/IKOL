import { Composer } from 'grammy';
import { nasaApi, spacexApi } from '../../services/api/index.js';
import { getLogger } from '../../services/logger/index.js';

const logger = getLogger({ module: 'space' });
const bot = new Composer();

// /apod command - Astronomy Picture of the Day
bot.command('apod', async (ctx) => {
  const statusMessage = await ctx.reply('🚀 Fetching Astronomy Picture of the Day...');
  
  try {
    const data = await nasaApi.get<any>('/planetary/apod');
    
    const message = 
      `🌌 **Astronomy Picture of the Day**\n\n` +
      `📌 **${data.title}**\n\n` +
      `${data.explanation?.substring(0, 500)}${data.explanation?.length > 500 ? '...' : ''}\n\n` +
      `📅 Date: ${data.date}\n` +
      `👨‍🚀 Credit: ${data.copyright || 'NASA'}`;
    
    // Send image if available
    if (data.media_type === 'image' && data.url) {
      await ctx.replyWithPhoto(data.url, {
        caption: message.substring(0, 1024),
        parse_mode: 'Markdown',
      });
    } else {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        message,
        { parse_mode: 'Markdown' }
      );
    }
    
  } catch (error) {
    logger.error('APOD fetch failed', error as Error);
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      '❌ Failed to fetch Astronomy Picture of the Day.'
    );
  }
});

// /spacex command - Latest SpaceX launch
bot.command('spacex', async (ctx) => {
  const statusMessage = await ctx.reply('🚀 Fetching latest SpaceX launch...');
  
  try {
    const launch = await spacexApi.get<any>('/launches/latest');
    
    const message = 
      `🚀 **${launch.name}**\n\n` +
      `📅 Date: ${new Date(launch.date_utc).toLocaleDateString()}\n` +
      `📊 Status: ${launch.success ? '✅ Success' : '❌ Failed'}\n` +
      `🪂 Landing: ${launch.cores?.[0]?.land_success ? '✅ Success' : 'N/A'}\n\n` +
      `${launch.details || 'No details available.'}`;
    
    if (launch.links?.patch?.large) {
      await ctx.replyWithPhoto(launch.links.patch.large, {
        caption: message.substring(0, 1024),
        parse_mode: 'Markdown',
      });
    } else {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        message,
        { parse_mode: 'Markdown' }
      );
    }
    
  } catch (error) {
    logger.error('SpaceX fetch failed', error as Error);
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      '❌ Failed to fetch SpaceX launch data.'
    );
  }
});

// /mars command - Mars Rover Photos
bot.command('mars', async (ctx) => {
  const statusMessage = await ctx.reply('🔴 Fetching Mars Rover photos...');
  
  try {
    const data = await nasaApi.get<{ photos: any[] }>(
      '/mars-photos/api/v1/rovers/curiosity/photos',
      { sol: '1000', page: '1' }
    );
    
    const photos = data.photos?.slice(0, 5) || [];
    
    if (photos.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        '❌ No Mars photos available.'
      );
      return;
    }
    
    // Send first photo
    const photo = photos[0];
    const caption = 
      `🔴 **Mars Rover Photo**\n\n` +
      `📷 Camera: ${photo.camera?.full_name}\n` +
      `📅 Date: ${photo.earth_date}\n` +
      `🤖 Rover: ${photo.rover?.name}`;
    
    await ctx.replyWithPhoto(photo.img_src, {
      caption,
      parse_mode: 'Markdown',
    });
    
  } catch (error) {
    logger.error('Mars photos fetch failed', error as Error);
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      '❌ Failed to fetch Mars Rover photos.'
    );
  }
});

// /space command - Space information menu
bot.command('space', async (ctx) => {
  await ctx.reply(
    '🚀 **Space Information**\n\n' +
    'Choose a category:\n\n' +
    '🌌 Astronomy Picture of the Day\n' +
    '🚀 Latest SpaceX Launch\n' +
    '🔴 Mars Rover Photos\n' +
    '☄️ Near Earth Objects',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🌌 APOD', callback_data: 'space:apod' },
            { text: '🚀 SpaceX', callback_data: 'space:spacex' },
          ],
          [
            { text: '🔴 Mars', callback_data: 'space:mars' },
            { text: '☄️ NEO', callback_data: 'space:neo' },
          ],
        ],
      },
    }
  );
});

// Callback handlers
bot.callback_query(/^space:(.+)$/, async (ctx) => {
  const action = ctx.match[1];
  await ctx.answerCallbackQuery();
  
  // Route to appropriate handler
  switch (action) {
    case 'apod':
      // Trigger APOD command
      break;
    case 'spacex':
      // Trigger SpaceX command
      break;
    case 'mars':
      // Trigger Mars command
      break;
    case 'neo':
      await ctx.reply('☄️ Near Earth Objects feature coming soon!');
      break;
  }
});

export default bot;
