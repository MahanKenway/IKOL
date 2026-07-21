import type { Context, NextFunction } from 'grammy';
import type { Env } from '../../types/env.js';
import { DatabaseService } from '../../services/database/index.js';
import { TieredCache } from '../../services/cache/tiered.js';
import { RateLimiter } from '../../services/rate-limiter/index.js';
import { getLogger, generateRequestId } from '../../services/logger/index.js';

const logger = getLogger({ module: 'middleware' });

// Lightweight typed context extension
export interface IkolContext extends Context {
  env: Env;
  db: DatabaseService | null;
  cache: TieredCache;
  rateLimiter: RateLimiter;
  userId: number;
  username?: string;
  firstName: string;
  language: string;
  isAdmin: boolean;
  requestId: string;
}

export function envMiddleware(env: Env) {
  return async (ctx: Context, next: NextFunction) => {
    (ctx as any).env = env;
    await next();
  };
}

export function servicesMiddleware() {
  return async (ctx: Context, next: NextFunction) => {
    const env = (ctx as any).env as Env;
    if (env?.DB) {
      (ctx as any).db = new DatabaseService(env.DB);
    }
    if (env?.KV) {
      (ctx as any).cache = new TieredCache(env.KV);
      (ctx as any).rateLimiter = new RateLimiter(env.KV);
    } else {
      (ctx as any).cache = new TieredCache(null);
      (ctx as any).rateLimiter = null;
    }
    await next();
  };
}

export function userMiddleware() {
  return async (ctx: Context, next: NextFunction) => {
    const requestId = generateRequestId();
    (ctx as any).requestId = requestId;

    const user = ctx.from;
    if (user) {
      (ctx as any).userId = user.id;
      (ctx as any).username = user.username;
      (ctx as any).firstName = user.first_name;

      // Set default language from Telegram
      (ctx as any).language = user.language_code?.startsWith('fa') ? 'fa' : 'en';
      (ctx as any).isAdmin = false;

      const db = (ctx as any).db as DatabaseService | null;
      if (db) {
        try {
          const existingUser = await db.getUser(user.id);
          if (!existingUser) {
            await db.createUser(user.id, user.username, user.first_name, user.last_name);
          } else {
            db.updateLastActive(user.id).catch(() => {});
            if (existingUser.language) (ctx as any).language = existingUser.language;
            (ctx as any).isAdmin = existingUser.is_admin === 1;
          }
        } catch {
          // Keep defaults from Telegram
        }
      }
    }
    await next();
  };
}

export function rateLimitMiddleware(limit: number = 30, windowSeconds: number = 60) {
  return async (ctx: Context, next: NextFunction) => {
    const userId = ctx.from?.id;
    const rl = (ctx as any).rateLimiter as RateLimiter | null;

    if (!userId || !rl) {
      await next();
      return;
    }

    try {
      const result = await rl.check(`user:${userId}`, limit, windowSeconds);
      if (!result.allowed) {
        await ctx.reply(`Rate limit exceeded. Try again in ${result.retryAfter}s.`);
        return;
      }
    } catch {
      // Continue on rate limit failure (fail open)
    }

    await next();
  };
}

export function errorMiddleware() {
  return async (ctx: Context, next: NextFunction) => {
    try {
      await next();
    } catch (error) {
      const err = error as Error;
      const requestId = (ctx as any).requestId || 'unknown';
      const updateText = ctx.message?.text || (ctx as any).callback_query?.data || '';
      logger.error('HANDLER ERROR', {
        requestId,
        userId: ctx.from?.id,
        username: ctx.from?.username,
        chatId: ctx.chat?.id,
        updateType: ctx.message ? 'message' : ctx.callbackQuery ? 'callback' : 'other',
        text: String(updateText).substring(0, 100),
        error: err.message,
        stack: err.stack?.substring(0, 500),
      });

      try {
        await ctx.reply('Something went wrong. Please try again.');
        logger.info('Error reply sent successfully', { requestId, userId: ctx.from?.id });
      } catch (replyError) {
        logger.error('FAILED to send error reply', {
          requestId,
          userId: ctx.from?.id,
          chatId: ctx.chat?.id,
          replyError: (replyError as Error).message,
        });
      }
    }
  };
}

export function loggingMiddleware() {
  return async (ctx: Context, next: NextFunction) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    if (duration > 5000) {
      logger.warn('Slow update', {
        requestId: (ctx as any).requestId,
        latency: duration,
        userId: ctx.from?.id,
      });
    }
  };
}

export function languageMiddleware() {
  return async (ctx: Context, next: NextFunction) => {
    // Language is already set by userMiddleware; this is a safety net
    if (!(ctx as any).language) {
      const userLang = ctx.from?.language_code || 'en';
      (ctx as any).language = userLang.startsWith('fa') ? 'fa' : 'en';
    }
    await next();
  };
}
