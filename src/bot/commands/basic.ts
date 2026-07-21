import { Composer } from 'grammy';
import { formatNumber } from '../../utils/helpers.js';
import { getRegisteredModules } from '../plugin-system.js';
import { getFeatureFlags } from '../../services/feature-flags/index.js';
import { getLogger } from '../../services/logger/index.js';
import type { Env } from '../../types/env.js';

const logger = getLogger({ module: 'commands' });
const bot = new Composer();

bot.command('start', async (ctx) => {
  logger.info('/start triggered', {
    userId: ctx.from?.id,
    username: ctx.from?.username,
    chatId: ctx.chat?.id,
    chatType: ctx.chat?.type,
  });

  const name = ctx.from?.first_name || 'User';
  const lang = (ctx as any).language || 'en';
  const welcome = lang === 'fa'
    ? `به ایکول خوش آمدید، ${name}!\n\nمن دستیار هوش مصنوعی شما هستم.\n\nبرای شروع:\n/help - راهنما\n/ai - چت با AI\n/download - دانلود\n/music - موسیقی\n/image - جستجوی تصویر\n\nهر پیامی برای من بفرستید!`
    : `Welcome to Ikol, ${name}!\n\nI'm your AI assistant in Telegram.\n\nGet started:\n/help - All commands\n/ai - Chat with AI\n/download - Download media\n/music - Search music\n/image - Search images\n\nOr just send me a message!`;

  try {
    const reply = await ctx.reply(welcome, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'AI Chat', callback_data: 'menu:ai' }, { text: 'Download', callback_data: 'menu:download' }],
          [{ text: 'Music', callback_data: 'menu:music' }, { text: 'Image Search', callback_data: 'menu:image' }],
          [{ text: 'Finance', callback_data: 'menu:finance' }, { text: 'Space', callback_data: 'menu:space' }],
          [{ text: 'Games', callback_data: 'menu:games' }],
        ],
      },
    });
    logger.info('/start reply sent', {
      userId: ctx.from?.id,
      chatId: ctx.chat?.id,
      messageId: reply.message_id,
    });
  } catch (e) {
    logger.error('/start reply FAILED', {
      userId: ctx.from?.id,
      chatId: ctx.chat?.id,
      error: (e as Error).message,
    });
  }
});

// /start callback button handlers
bot.callbackQuery(/^menu:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const section = ctx.match[1];
  const replies: Record<string, string> = {
    ai: 'AI Chat\n\nSend /ai <message> to start chatting!\nOr just send me any text message.',
    download: 'Downloader\n\nSend /download <url> or just paste a link!\nSupported: YouTube, Instagram, TikTok, Twitter, Reddit, and more.',
    music: 'Music Search\n\n/music <song name> - Search songs\n/lyrics <song name> - Get lyrics',
    image: 'Image Search\n\n/image <query> - Search images\n/pin <query> - Search Pinterest\n\nProviders: Pinterest, Pexels, Pixabay, Unsplash, Wikimedia',
    finance: 'Finance\n\n/currency - Exchange rates\n/gold - Gold prices\n/crypto <coin> - Crypto prices',
    space: 'Space\n\n/apod - Astronomy Picture of the Day\n/spacex - Latest launch\n/mars - Mars Rover photos',
    games: 'Gaming\n\n/freegames - Free games on Epic Store',
  };
  await ctx.reply(replies[section] || 'Unknown section');
});

bot.command('help', async (ctx) => {
  const lang = (ctx as any).language || 'en';
  const msg = lang === 'fa'
    ? `راهنمای ایکول\n\nهوش مصنوعی:\n/ai - چت با AI\n/model - تغییر مدل\n clears - پاک کردن تاریخچه\n\nدانلود:\n/download - دانلود از لینک\nیا لینک بفرستید!\n\nموسیقی:\n/music - جستجو\n/lyrics - متن آهنگ\n\nتصویر:\n/image - جستجوی تصویر\n/pin - جستجوی پینترست\n\nمالی:\n/currency - نرخ ارز\n/gold - طلا\n/crypto - ارز دیجیتال\n\nفضا:\n/apod - تصویر نجومی\n/spacex - آخرین پرتاب\n/mars - مریخ\n\nبازی:\n/freegames - بازی رایگان\n\nابزارها:\n/weather - آب و هوا\n/qr - کد QR\n/translate - ترجمه\n/wiki - ویکیپدیا\n/password - رمز عبور\n\nسایر:\n/today - مناسبت امروز\n/randomfact - حقیقت جالب\n/quote - جمله الهامبخش\n/stats - آمار`
    : `Ikol Help\n\nAI:\n/ai <msg> - Chat with AI\n/model - Change AI model\n/clear - Clear history\n\nDownloads:\n/download <url> - Download\nOr just send a link!\n\nMusic:\n/music <query> - Search\n/lyrics <query> - Get lyrics\n\nImages:\n/image <query> - Search images\n/pin <query> - Pinterest search\n\nFinance:\n/currency - Exchange rates\n/gold - Gold prices\n/crypto <coin> - Crypto\n\nSpace:\n/apod - Astronomy Picture\n/spacex - Latest launch\n/mars - Mars photos\n\nGaming:\n/freegames - Free games\n\nUtilities:\n/weather <city> - Weather\n/qr <text> - QR code\n/translate <text> - Translate\n/wiki <topic> - Wikipedia\n/password - Generate password\n\nOther:\n/today - Today's fun days\n/randomfact - Fun fact\n/quote - Motivational quote\n/stats - Bot statistics`;
  await ctx.reply(msg);
});

bot.command('settings', async (ctx) => {
  const db = (ctx as any).db;
  const userId = ctx.from?.id;
  if (!db || !userId) { await ctx.reply('Database not available.'); return; }
  try {
    const user = await db.getUser(userId);
    let s: Record<string, unknown> = {};
    if (user?.settings) try { s = JSON.parse(user.settings); } catch {}
    await ctx.reply(
      `Settings\n\nLanguage: ${(ctx as any).language || 'en'}\nAI Provider: ${(s.aiProvider as string) || 'gemini'}\nAI Model: ${(s.aiModel as string) || 'gemini-1.5-flash'}`,
      { reply_markup: { inline_keyboard: [[{ text: 'Change AI Provider', callback_data: 'settings:ai_provider' }]] } }
    );
  } catch { await ctx.reply('Failed to load settings.'); }
});

bot.command('stats', async (ctx) => {
  const db = (ctx as any).db;
  if (!db) { await ctx.reply('Database not available.'); return; }
  try {
    const stats = await db.getStats();
    await ctx.reply(`Bot Statistics\n\nUsers: ${formatNumber(stats.totalUsers)}\nMessages: ${formatNumber(stats.totalMessages)}\nDownloads: ${formatNumber(stats.totalDownloads)}`);
  } catch { await ctx.reply('Failed to load stats.'); }
});

bot.command('debug', async (ctx) => {
  const env = (ctx as any).env as Env | undefined;
  const ownerIds = env?.OWNER_IDS?.split(',').map(id => id.trim()) || [];
  const userId = ctx.from?.id?.toString();

  if (!userId || !ownerIds.includes(userId)) {
    await ctx.reply('Access denied. Owner only.');
    return;
  }

  const flags = env ? getFeatureFlags(env) : null;
  const modules = getRegisteredModules();

  const version = '2.1.0';
  const environment = env?.ENVIRONMENT || 'unknown';

  const enabledModules = modules.filter(m => {
    if (!flags) return true;
    return flags[m.featureFlag];
  });

  const disabledModules = modules.filter(m => {
    if (!flags) return false;
    return !flags[m.featureFlag];
  });

  const providers: string[] = [];
  if (env?.OPENAI_API_KEY) providers.push('OpenAI');
  if (env?.GEMINI_API_KEY) providers.push('Gemini');
  if (env?.ANTHROPIC_API_KEY) providers.push('Anthropic');
  if (env?.OPENROUTER_API_KEY) providers.push('OpenRouter');
  if (env?.PINTEREST_ACCESS_TOKEN) providers.push('Pinterest (API)');
  else if (env?.PINTEREST_ENABLED !== 'false') providers.push('Pinterest (Internal)');
  if (env?.PEXELS_API_KEY) providers.push('Pexels');
  if (env?.PIXABAY_API_KEY) providers.push('Pixabay');
  if (env?.UNSPLASH_ACCESS_KEY) providers.push('Unsplash');

  const debugInfo = [
    `Bot Debug Info`,
    ``,
    `Version: ${version}`,
    `Environment: ${environment}`,
    `Worker: ikol-bot`,
    ``,
    `Enabled Modules (${enabledModules.length}):`,
    ...enabledModules.map(m => `  - ${m.name} v${m.version}`),
    ``,
    `Disabled Modules (${disabledModules.length}):`,
    ...disabledModules.map(m => `  - ${m.name}`),
    ``,
    `Active Providers (${providers.length}):`,
    ...providers.map(p => `  - ${p}`),
    ``,
    `Feature Flags:`,
    ...Object.entries(flags || {}).map(([k, v]) => `  ${k}: ${v}`),
  ].join('\n');

  await ctx.reply(debugInfo);
});

bot.command('trace', async (ctx) => {
  const env = (ctx as any).env as Env | undefined;
  const ownerIds = env?.OWNER_IDS?.split(',').map(id => id.trim()) || [];
  const userId = ctx.from?.id?.toString();

  if (!userId || !ownerIds.includes(userId)) {
    await ctx.reply('Access denied. Owner only.');
    return;
  }

  const startTime = Date.now();
  const traceLines: string[] = [];

  traceLines.push('=== TELEGRAM RUNTIME TRACE ===');
  traceLines.push('');

  // 1. Bot identity
  traceLines.push('1. BOT IDENTITY');
  try {
    const me = await ctx.api.getMe();
    traceLines.push(`   Bot ID: ${me.id}`);
    traceLines.push(`   Username: @${me.username}`);
    traceLines.push(`   First Name: ${me.first_name}`);
  } catch (e) {
    traceLines.push(`   ERROR getting bot info: ${(e as Error).message}`);
  }
  traceLines.push('');

  // 2. Environment
  traceLines.push('2. ENVIRONMENT');
  traceLines.push(`   BOT_TOKEN: ${env?.BOT_TOKEN ? 'SET (' + env.BOT_TOKEN.substring(0, 10) + '...)' : 'MISSING'}`);
  traceLines.push(`   BOT_WEBHOOK_SECRET: ${env?.BOT_WEBHOOK_SECRET ? 'SET' : 'MISSING'}`);
  traceLines.push(`   GEMINI_API_KEY: ${env?.GEMINI_API_KEY ? 'SET' : 'MISSING'}`);
  traceLines.push(`   OPENAI_API_KEY: ${env?.OPENAI_API_KEY ? 'SET' : 'MISSING'}`);
  traceLines.push(`   ENVIRONMENT: ${env?.ENVIRONMENT || 'not set'}`);
  traceLines.push('');

  // 3. Context
  traceLines.push('3. REQUEST CONTEXT');
  traceLines.push(`   Your User ID: ${ctx.from?.id}`);
  traceLines.push(`   Your Username: @${ctx.from?.username || 'none'}`);
  traceLines.push(`   Chat ID: ${ctx.chat?.id}`);
  traceLines.push(`   Chat Type: ${ctx.chat?.type}`);
  traceLines.push(`   Message ID: ${ctx.message?.message_id}`);
  traceLines.push(`   Is Owner: ${ownerIds.includes(userId)}`);
  traceLines.push('');

  // 4. Modules
  traceLines.push('4. LOADED MODULES');
  const modules = getRegisteredModules();
  traceLines.push(`   Count: ${modules.length}`);
  for (const m of modules) {
    traceLines.push(`   - ${m.name} v${m.version}`);
  }
  traceLines.push('');

  // 5. Test sendMessage
  traceLines.push('5. TELEGRAM API TEST');
  try {
    const testMsg = await ctx.api.sendMessage(
      ctx.chat!.id,
      'Trace test message - if you see this, sendMessage works!'
    );
    traceLines.push(`   sendMessage: SUCCESS (message_id: ${testMsg.message_id})`);
  } catch (e) {
    traceLines.push(`   sendMessage: FAILED - ${(e as Error).message}`);
  }
  traceLines.push('');

  // 6. Timing
  traceLines.push('6. TIMING');
  traceLines.push(`   Trace completed in ${Date.now() - startTime}ms`);

  await ctx.reply(traceLines.join('\n'));
});

export default bot;
