// Basic commands - Cloudflare Workers compatible
import { Composer } from 'grammy';

const bot = new Composer();

bot.command('start', (ctx) => {
  const name = ctx.from?.first_name || 'there';
  return ctx.reply(`Hello ${name}! I'm IKOL.\nUse /help for commands.`);
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

export default bot;
