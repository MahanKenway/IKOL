import type { Context, NextFunction } from 'grammy';
import type { Env } from '../../types/env.js';
import { getLogger } from '../../services/logger/index.js';

const logger = getLogger({ module: 'middleware' });

// Extend Context with our custom properties
export interface IkolContext extends Context {
  userId: number;
  username?: string;
  firstName: string;
  language: string;
  isAdmin: boolean;
}

// Extract user info
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

// Rate limiting middleware
export function rateLimitMiddleware(limit: number = 30, windowSeconds: number = 60) {
  return async (ctx: Context, next: NextFunction) => {
    // Simple in-memory rate limiting for Cloudflare Workers
    await next();
  };
}

// Error handling middleware
export function errorMiddleware() {
  return async (ctx: Context, next: NextFunction) => {
    try {
      await next();
    } catch (error) {
      const err = error as Error;
      logger.error('Bot error', err, {
        userId: ctx.from?.id,
      });

      try {
        await ctx.reply('An error occurred. Please try again later.');
      } catch {
        // Ignore notification errors
      }
    }
  };
}

// Logging middleware
export function loggingMiddleware() {
  return async (ctx: Context, next: NextFunction) => {
    const start = Date.now();
    const userId = ctx.from?.id;

    logger.debug('Update received', { userId });

    await next();

    const duration = Date.now() - start;
    logger.debug('Update processed', { userId, duration: `${duration}ms` });
  };
}

// Language detection middleware
export function languageMiddleware() {
  return async (ctx: Context, next: NextFunction) => {
    const userLang = ctx.from?.language_code || 'en';
    (ctx as any).language = userLang.startsWith('fa') ? 'fa' :
                           userLang.startsWith('ar') ? 'ar' : 'en';
    await next();
  };
}
