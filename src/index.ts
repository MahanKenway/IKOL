// IKOL Bot - Cloudflare Workers Entry Point

import { createBot } from './bot/index.js';
import type { Env } from './types/env.js';

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }

    // Home page
    if (url.pathname === '/') {
      return new Response('IKOL Bot is running!', { status: 200 });
    }

    // Only handle POST for Telegram webhooks
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // Create bot with token from environment
      const bot = createBot(env.TELEGRAM_BOT_TOKEN);

      // Cache bot info in KV to avoid getMe on every request
      const botInfoStr = await env.KV.get('bot_info');
      if (botInfoStr) {
        bot.botInfo = JSON.parse(botInfoStr);
      } else {
        const me = await bot.api.getMe();
        await env.KV.put('bot_info', JSON.stringify(me), { expirationTtl: 86400 });
        bot.botInfo = me;
      }

      // Process the Telegram update
      const update = await request.json();
      await bot.handleUpdate(update as any);

      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal server error', { status: 500 });
    }
  },
};
