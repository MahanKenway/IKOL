import { Bot } from 'grammy';
import {
  envMiddleware,
  servicesMiddleware,
  userMiddleware,
  rateLimitMiddleware,
  errorMiddleware,
  loggingMiddleware,
  languageMiddleware,
} from './middleware/index.js';
import type { Env } from '../types/env.js';
import { getFeatureFlags } from '../services/feature-flags/index.js';
import { loadModules } from './plugin-system.js';
import basicCommands from './commands/basic.js';

// Import all modules (triggers auto-registration via plugin system)
import '../modules/ai/enhanced.js';
import '../modules/downloader/enhanced.js';
import '../modules/music/enhanced.js';
import '../modules/finance/index.js';
import '../modules/space/index.js';
import '../modules/games/index.js';
import '../modules/fun-calendar/index.js';
import '../modules/utilities/index.js';
import '../modules/admin/index.js';
import '../modules/image-search/enhanced.js';

export function createBot(token: string, env: Env, botInfo?: any) {
  const bot = new Bot(token, { botInfo });
  const flags = getFeatureFlags(env);

  // Middleware order:
  // 1. errorMiddleware (catches all)
  // 2. loggingMiddleware (logs every update)
  // 3. envMiddleware (injects env)
  // 4. servicesMiddleware (DB/Cache)
  // 5. userMiddleware (user info)
  // 6. rateLimitMiddleware
  // 7. languageMiddleware
  bot.use(errorMiddleware());
  bot.use(loggingMiddleware());
  bot.use(envMiddleware(env));
  bot.use(servicesMiddleware());
  bot.use(userMiddleware());
  if (flags.rateLimiting) {
    bot.use(rateLimitMiddleware(30, 60));
  }
  bot.use(languageMiddleware());

  // Basic commands (/start, /help, /settings, /stats)
  bot.use(basicCommands);

  // Auto-discover and load all registered modules
  loadModules(bot as any, env, flags);

  // Global catch-all for unhandled errors
  bot.catch((err) => {
    console.error('[BOT] Uncaught error:', err);
  });

  return bot;
}
