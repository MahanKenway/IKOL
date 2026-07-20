import { Composer } from 'grammy';
import { CONFIG } from '../../config/index.js';
import { formatNumber } from '../../utils/helpers.js';

const bot = new Composer();

// /start command
bot.command('start', async (ctx) => {
  const name = ctx.from?.first_name || 'User';
  const language = (ctx as any).language || 'en';
  
  const welcomeMessage = language === 'fa'
    ? `🌟 به ایکول خوش آمدید، ${name}!\n\n` +
      `من دستیار هوش مصنوعی شما در تلگرام هستم.\n\n` +
      `📌 برای شروع، از دستورات زیر استفاده کنید:\n` +
      `/help - راهنما\n` +
      `/ai - چت با هوش مصنوعی\n` +
      `/download - دانلود رسانه\n` +
      `/music - جستجوی موسیقی\n\n` +
      `💡 همچنین می‌توانید هر پیامی را برای من ارسال کنید!`
    : `🌟 Welcome to Ikol, ${name}!\n\n` +
      `I'm your intelligent AI assistant in Telegram.\n\n` +
      `📌 To get started, use these commands:\n` +
      `/help - Show help\n` +
      `/ai - Chat with AI\n` +
      `/download - Download media\n` +
      `/music - Search music\n\n` +
      `💡 You can also just send me any message!`;
  
  await ctx.reply(welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🤖 AI Chat', callback_data: 'ai:start' },
          { text: '📥 Download', callback_data: 'download:start' },
        ],
        [
          { text: '🎵 Music', callback_data: 'music:start' },
          { text: '💰 Finance', callback_data: 'finance:start' },
        ],
        [
          { text: '🚀 Space', callback_data: 'space:start' },
          { text: '🎮 Games', callback_data: 'games:start' },
        ],
      ],
    },
  });
});

// /help command
bot.command('help', async (ctx) => {
  const language = (ctx as any).language || 'en';
  
  const helpMessage = language === 'fa'
    ? `📚 راهنمای ایکول\n\n` +
      `🤖 هوش مصنوعی:\n` +
      `/ai - شروع چت با AI\n` +
      `/ai <پیام> - ارسال پیام مستقیم\n` +
      `/model - تغییر مدل AI\n` +
      `/clear - پاک کردن تاریخچه\n\n` +
      `📥 دانلود:\n` +
      `/download - دانلود از لینک\n` +
      `یا فقط لینک را ارسال کنید!\n\n` +
      `🎵 موسیقی:\n` +
      `/music - جستجوی آهنگ\n` +
      `/artist - اطلاعات هنرمند\n` +
      `/album - اطلاعات آلبوم\n\n` +
      `💰 مالی:\n` +
      `/currency - نرخ ارز\n` +
      `/gold - قیمت طلا\n\n` +
      `🚀 فضا:\n` +
      `/apod - تصویر نجومی روز\n` +
      `/spacex - آخرین پرتاب\n\n` +
      `🎮 بازی:\n` +
      `/freegames - بازی‌های رایگان\n\n` +
      `🔧 سایر:\n` +
      `/settings - تنظیمات\n` +
      `/stats - آمار استفاده`
    : `📚 Ikol Help Guide\n\n` +
      `🤖 AI Chat:\n` +
      `/ai - Start AI chat\n` +
      `/ai <message> - Send direct message\n` +
      `/model - Change AI model\n` +
      `/clear - Clear history\n\n` +
      `📥 Downloads:\n` +
      `/download - Download from link\n` +
      `Or just send a link!\n\n` +
      `🎵 Music:\n` +
      `/music - Search song\n` +
      `/artist - Artist info\n` +
      `/album - Album info\n\n` +
      `💰 Finance:\n` +
      `/currency - Exchange rates\n` +
      `/gold - Gold prices\n\n` +
      `🚀 Space:\n` +
      `/apod - Astronomy Picture of the Day\n` +
      `/spacex - Latest launch\n\n` +
      `🎮 Gaming:\n` +
      `/freegames - Free games\n\n` +
      `🔧 Other:\n` +
      `/settings - Settings\n` +
      `/stats - Usage statistics`;
  
  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

// /settings command
bot.command('settings', async (ctx) => {
  const db = (ctx as any).db;
  const userId = ctx.from?.id;
  
  if (!db || !userId) {
    await ctx.reply('❌ Database not available.');
    return;
  }
  
  const user = await db.getUser(userId);
  const settings = user?.settings ? JSON.parse(user.settings) : {};
  
  const settingsMessage = 
    `⚙️ Settings\n\n` +
    `🌍 Language: ${(ctx as any).language || 'en'}\n` +
    `🤖 AI Provider: ${settings.aiProvider || 'gemini'}\n` +
    `🧠 AI Model: ${settings.aiModel || 'gemini-1.5-flash'}\n` +
    `🔔 Notifications: ${settings.notifications !== false ? 'ON' : 'OFF'}`;
  
  await ctx.reply(settingsMessage, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🌍 Language', callback_data: 'settings:language' },
          { text: '🤖 AI Provider', callback_data: 'settings:ai_provider' },
        ],
        [
          { text: '🔔 Notifications', callback_data: 'settings:notifications' },
        ],
      ],
    },
  });
});

// /stats command
bot.command('stats', async (ctx) => {
  const db = (ctx as any).db;
  
  if (!db) {
    await ctx.reply('❌ Database not available.');
    return;
  }
  
  const stats = await db.getStats();
  
  const statsMessage = 
    `📊 Bot Statistics\n\n` +
    `👥 Total Users: ${formatNumber(stats.totalUsers)}\n` +
    `💬 Total Messages: ${formatNumber(stats.totalMessages)}\n` +
    `📥 Total Downloads: ${formatNumber(stats.totalDownloads)}\n\n` +
    `⏰ Server Time: ${new Date().toISOString()}`;
  
  await ctx.reply(statsMessage, { parse_mode: 'Markdown' });
});

export default bot;
