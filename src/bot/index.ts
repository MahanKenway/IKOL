// Bot setup - Cloudflare Workers compatible

import { Bot, Composer } from 'grammy';
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
    return ctx.reply(
      `Hello ${name}! I'm IKOL (Intelligent Knowledge & Operations Layer).\n\n` +
      `I'm an AI assistant that can help you with various tasks.\n\n` +
      `Use /help to see available commands.`
    );
  });

  bot.command('help', (ctx) => {
    return ctx.reply(
      'IKOL Commands:\n\n' +
      '/start - Welcome message\n' +
      '/help - Show this help\n' +
      '/time - Current time\n' +
      '/ping - Test connection\n\n' +
      'You can also send me any text message!'
    );
  });

  bot.command('time', (ctx) => {
    const now = new Date();
    return ctx.reply(`Current time: ${now.toUTCString()}`);
  });

  bot.command('ping', (ctx) => {
    return ctx.reply('Pong! Connection is active.');
  });

  // Handle text messages
  bot.on('message:text', (ctx) => {
    const text = ctx.message.text;
    return ctx.reply(`I received: ${text}\n\nUse /help to see commands.`);
  });

  // Error handler
  bot.catch((err) => {
    console.error('Bot error:', err);
  });

  return bot;
}
