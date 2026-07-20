// Bot setup - Cloudflare Workers compatible

import { Bot } from 'grammy';
import {
  userMiddleware,
  rateLimitMiddleware,
  errorMiddleware,
  loggingMiddleware,
  languageMiddleware
} from './middleware/index.js';

export function createBot(token: string) {
  const bot = new Bot(token);

  // Middleware
  bot.use(loggingMiddleware());
  bot.use(userMiddleware());
  bot.use(rateLimitMiddleware());
  bot.use(errorMiddleware());
  bot.use(languageMiddleware());

  // Commands
  bot.command('start', (ctx) => {
    const name = ctx.from?.first_name || 'there';
    const lang = (ctx as any).language || 'en';
    const text = lang === 'fa'
      ? `سلام ${name}! 👋\nمن IKOL هستم.\nاز /help برای راهنما استفاده کنید.`
      : `Hello ${name}! 👋\nI'm IKOL.\nUse /help for commands.`;
    return ctx.reply(text);
  });

  bot.command('help', (ctx) => {
    return ctx.reply(
      'IKOL Commands:\n\n' +
      '/start - Welcome\n' +
      '/help - Help\n' +
      '/time - Current time\n' +
      '/ping - Test connection'
    );
  });

  bot.command('time', (ctx) => {
    return ctx.reply(`Time: ${new Date().toUTCString()}`);
  });

  bot.command('ping', (ctx) => {
    return ctx.reply('Pong!');
  });

  bot.on('message:text', (ctx) => {
    return ctx.reply(`Received: ${ctx.message.text}`);
  });

  bot.catch((err) => console.error('Bot error:', err));

  return bot;
}
