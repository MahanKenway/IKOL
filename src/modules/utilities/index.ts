import { Composer } from 'grammy';
import { getLogger } from '../../services/logger/index.js';

const logger = getLogger({ module: 'utilities' });
const bot = new Composer();

// /weather command (using wttr.in)
bot.command('weather', async (ctx) => {
  const city = ctx.message?.text?.replace(/^\/weather\s*/, '').trim();
  
  if (!city) {
    await ctx.reply(
      '🌤 **Weather**\n\n' +
      'Usage: `/weather <city>`\n\n' +
      'Example: `/weather London`',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  const statusMessage = await ctx.reply(`🌤 Fetching weather for ${city}...`);
  
  try {
    const response = await fetch(
      `https://wttr.in/${encodeURIComponent(city)}?format=j1`
    );
    const data = await response.json() as any;
    
    const current = data.current_condition?.[0];
    if (!current) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        `❌ City "${city}" not found.`
      );
      return;
    }
    
    const message = 
      `🌤 **Weather in ${city}**\n\n` +
      `🌡 Temperature: ${current.temp_C}°C / ${current.temp_F}°F\n` +
      `💧 Humidity: ${current.humidity}%\n` +
      `💨 Wind: ${current.windspeedKmph} km/h ${current.winddir16Point}\n` +
      `☁️ Condition: ${current.weatherDesc?.[0]?.value || 'N/A'}\n` +
      `👁 Visibility: ${current.visibility} km`;
    
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      message,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    logger.error('Weather fetch failed', error as Error, { city });
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      '❌ Failed to fetch weather data.'
    );
  }
});

// /qr command
bot.command('qr', async (ctx) => {
  const text = ctx.message?.text?.replace(/^\/qr\s*/, '').trim();
  
  if (!text) {
    await ctx.reply(
      '📱 **QR Code Generator**\n\n' +
      'Usage: `/qr <text or URL>`\n\n' +
      'Example: `/qr https://example.com`',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  try {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`;
    await ctx.replyWithPhoto(qrUrl, {
      caption: `📱 QR Code for: ${text.substring(0, 50)}`,
    });
  } catch (error) {
    logger.error('QR generation failed', error as Error);
    await ctx.reply('❌ Failed to generate QR code.');
  }
});

// /shorten command (using is.gd)
bot.command('shorten', async (ctx) => {
  const url = ctx.message?.text?.replace(/^\/shorten\s*/, '').trim();
  
  if (!url) {
    await ctx.reply(
      '🔗 **URL Shortener**\n\n' +
      'Usage: `/shorten <URL>`\n\n' +
      'Example: `/shorten https://example.com/very/long/url`',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  try {
    const response = await fetch(
      `https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`
    );
    const data = await response.json() as any;
    
    if (data.shorturl) {
      await ctx.reply(
        `🔗 **Shortened URL**\n\n` +
        `Original: ${url}\n` +
        `Short: ${data.shorturl}`,
        { parse_mode: 'Markdown' }
      );
    } else {
      await ctx.reply('❌ Failed to shorten URL.');
    }
  } catch (error) {
    logger.error('URL shortening failed', error as Error);
    await ctx.reply('❌ Failed to shorten URL.');
  }
});

// /password command
bot.command('password', async (ctx) => {
  const length = parseInt(ctx.message?.text?.replace(/^\/password\s*/, '').trim() || '16');
  const safeLength = Math.min(Math.max(length || 16, 8), 64);
  
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  for (let i = 0; i < safeLength; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  await ctx.reply(
    `🔐 **Random Password**\n\n` +
    `\`${password}\`\n\n` +
    `📏 Length: ${safeLength} characters`,
    { parse_mode: 'Markdown' }
  );
});

// /translate command
bot.command('translate', async (ctx) => {
  const text = ctx.message?.text?.replace(/^\/translate\s*/, '').trim();
  
  if (!text) {
    await ctx.reply(
      '🌐 **Translation**\n\n' +
      'Usage: `/translate <text>`\n\n' +
      'The bot will auto-detect and translate to English.',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  // Simple translation using free API
  try {
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|en`
    );
    const data = await response.json() as any;
    
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      await ctx.reply(
        `🌐 **Translation**\n\n` +
        `Original: ${text}\n\n` +
        `Translated: ${data.responseData.translatedText}`,
        { parse_mode: 'Markdown' }
      );
    } else {
      await ctx.reply('❌ Translation failed.');
    }
  } catch (error) {
    logger.error('Translation failed', error as Error);
    await ctx.reply('❌ Translation service unavailable.');
  }
});

// /wiki command
bot.command('wiki', async (ctx) => {
  const query = ctx.message?.text?.replace(/^\/wiki\s*/, '').trim();
  
  if (!query) {
    await ctx.reply(
      '📚 **Wikipedia Search**\n\n' +
      'Usage: `/wiki <topic>`\n\n' +
      'Example: `/wiki Artificial Intelligence`',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  const statusMessage = await ctx.reply(`📚 Searching Wikipedia for "${query}"...`);
  
  try {
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`
    );
    const data = await response.json() as any;
    
    if (data.extract) {
      const message = 
        `📚 **${data.title}**\n\n` +
        `${data.extract}\n\n` +
        `🔗 [Read more](${data.content_urls?.desktop?.page || '#'})`;
      
      if (data.thumbnail?.source) {
        await ctx.replyWithPhoto(data.thumbnail.source, {
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
    } else {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        `❌ No Wikipedia article found for "${query}".`
      );
    }
  } catch (error) {
    logger.error('Wikipedia search failed', error as Error, { query });
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      '❌ Wikipedia search failed.'
    );
  }
});

export default bot;
