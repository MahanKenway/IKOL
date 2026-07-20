// Middleware for IKOL bot - Cloudflare Workers compatible

import type { Context, NextFunction } from 'grammy';

export function userMiddleware() {
  return async (ctx: Context, next: NextFunction) => {
    const user = ctx.from;
    if (user) {
      (ctx as any).userId = user.id;
      (ctx as any).username = user.username;
      (ctx as any).firstName = user.first_name;
      (ctx as any).language = user.language_code?.startsWith('fa') ? 'fa' : 'en';
    }
    await next();
  };
}

export function rateLimitMiddleware(_limit: number = 30, _windowSeconds: number = 60) {
  return async (ctx: Context, next: NextFunction) => {
    // Rate limiting handled by KV in production
    await next();
  };
}

export function errorMiddleware() {
  return async (ctx: Context, next: NextFunction) => {
    try {
      await next();
    } catch (error) {
      console.error('Bot error:', error);
      try {
        await ctx.reply('An error occurred. Please try again later.');
      } catch {
        // Ignore
      }
    }
  };
}

export function loggingMiddleware() {
  return async (ctx: Context, next: NextFunction) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.log(`Slow update: ${duration}ms`);
    }
  };
}

export function languageMiddleware() {
  return async (ctx: Context, next: NextFunction) => {
    const userLang = ctx.from?.language_code || 'en';
    (ctx as any).language = userLang.startsWith('fa') ? 'fa' : 'en';
    await next();
  };
}
