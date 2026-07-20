import { createBunMiddleware } from 'grammy';
import { createBot } from './bot/index.js';
import type { Env } from './types/env.js';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle webhook verification
    if (request.method === 'GET') {
      const url = new URL(request.url);
      if (url.pathname === '/health') {
        return new Response('OK', { status: 200 });
      }
      if (url.pathname === '/') {
        return new Response('Ikol Bot is running!', { status: 200 });
      }
    }

    // Only handle POST requests for Telegram updates
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // Create bot instance
      const bot = createBot(env.BOT_TOKEN);

      // Set bot info to avoid getMe call on each request
      // This should be cached and updated periodically
      const botInfoStr = await env.KV.get('bot_info');
      if (botInfoStr) {
        const botInfo = JSON.parse(botInfoStr);
        bot.botInfo = botInfo;
      } else {
        // Fetch and cache bot info
        const me = await bot.api.getMe();
        await env.KV.put('bot_info', JSON.stringify(me), { expirationTtl: 86400 });
        bot.botInfo = me;
      }

      // Inject environment into context
      bot.use(async (ctx, next) => {
        (ctx as any).env = env;
        await next();
      });

      // Process the update
      const update = await request.json();
      await bot.handleUpdate(update as any);

      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Bot error:', error);
      return new Response('Internal server error', { status: 500 });
    }
  },
};
