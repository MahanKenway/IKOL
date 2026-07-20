import type { Context, NextFunction } from 'grammy';
import type { Env } from '../types/env.js';
import { DatabaseService } from '../services/database/index.js';
import { CacheService } from '../services/cache/index.js';
import { getLogger } from '../services/logger/index.js';

const logger = getLogger({ module: 'middleware' });

// Extend Context with our custom properties
export interface IkolContext extends Context {
  db: DatabaseService;
  cache: CacheService;
  userId: number;
  username?: string;
  firstName: string;
  language: string;
  isAdmin: boolean;
}

// Initialize database and cache services
export function servicesMiddleware() {
  return async (ctx: Context, next: NextFunction) => {
    const env = (ctx as any).env as Env;
    
    if (env?.DB) {
      (ctx as any).db = new DatabaseService(env.DB);
    }
    if (env?.KV) {
      (ctx as any).cache = new CacheService(env.KV);
    }
    
    await next();
  };
}

// Extract user info and create/update user record
export function userMiddleware() {
  return async (ctx: Context, next: NextFunction) => {
    const user = ctx.from;
    
    if (user) {
      (ctx as any).userId = user.id;
      (ctx as any).username = user.username;
      (ctx as any).firstName = user.first_name;
      
      // Get or create user in database
      const db = (ctx as any).db as DatabaseService;
      if (db) {
        const existingUser = await db.getUser(user.id);
        
        if (!existingUser) {
          await db.createUser(user.id, user.username, user.first_name, user.last_name);
          logger.info('New user registered', { userId: user.id, username: user.username });
        } else {
          await db.updateLastActive(user.id);
          (ctx as any).language = existingUser.language || 'en';
          (ctx as any).isAdmin = existingUser.is_admin === 1;
        }
      }
    }
    
    await next();
  };
}

// Rate limiting middleware
export function rateLimitMiddleware(limit: number = 30, windowSeconds: number = 60) {
  return async (ctx: Context, next: NextFunction) => {
    const userId = ctx.from?.id;
    const db = (ctx as any).db as DatabaseService;
    
    if (!userId || !db) {
      await next();
      return;
    }
    
    const isAllowed = await db.checkRateLimit(userId, 'global', limit, windowSeconds);
    
    if (!isAllowed) {
      await ctx.reply('⚠️ Rate limit exceeded. Please try again later.');
      return;
    }
    
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
        updateType: ctx.update.message ? 'message' : 
                    ctx.update.callback_query ? 'callback_query' : 'unknown',
      });
      
      // Notify user of error
      try {
        await ctx.reply('❌ An error occurred. Please try again later.');
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
    const chatId = ctx.chat?.id;
    
    logger.debug('Update received', {
      userId,
      chatId,
      type: ctx.update.message ? 'message' :
            ctx.update.callback_query ? 'callback_query' :
            ctx.update.inline_query ? 'inline_query' : 'other',
    });
    
    await next();
    
    const duration = Date.now() - start;
    logger.debug('Update processed', { userId, duration: `${duration}ms` });
  };
}

// Admin check middleware
export function adminMiddleware() {
  return async (ctx: Context, next: NextFunction) => {
    const isAdmin = (ctx as any).isAdmin;
    
    if (!isAdmin) {
      await ctx.reply('🔒 Admin access required.');
      return;
    }
    
    await next();
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
