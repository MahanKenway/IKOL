import { Bot } from 'grammy';
import { 
  servicesMiddleware, 
  userMiddleware, 
  rateLimitMiddleware, 
  errorMiddleware, 
  loggingMiddleware,
  languageMiddleware 
} from './middleware/index.js';
import basicCommands from './commands/basic.js';
import aiModule from '../modules/ai/enhanced.js';
import downloaderModule from '../modules/downloader/enhanced.js';
import musicModule from '../modules/music/enhanced.js';
import financeModule from '../modules/finance/index.js';
import spaceModule from '../modules/space/index.js';
import gamesModule from '../modules/games/index.js';
import funCalendarModule from '../modules/fun-calendar/index.js';
import utilitiesModule from '../modules/utilities/index.js';
import { getLogger } from '../services/logger/index.js';

const logger = getLogger({ module: 'bot' });

export function createBot(token: string, botInfo?: any) {
  const bot = new Bot(token, {
    botInfo,
  });

  // Install middleware in order
  bot.use(loggingMiddleware());
  bot.use(servicesMiddleware());
  bot.use(userMiddleware());
  bot.use(rateLimitMiddleware(30, 60));
  bot.use(errorMiddleware());
  bot.use(languageMiddleware());

  // Register command handlers
  bot.use(basicCommands);

  // Register enhanced feature modules
  bot.use(aiModule);
  bot.use(downloaderModule);
  bot.use(musicModule);
  bot.use(financeModule);
  bot.use(spaceModule);
  bot.use(gamesModule);
  bot.use(funCalendarModule);
  bot.use(utilitiesModule);

  // Error handler
  bot.catch((err) => {
    logger.error('Bot error', err as Error);
  });

  return bot;
}
