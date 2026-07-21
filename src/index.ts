import { createBot } from './bot/index.js';
import type { Env } from './types/env.js';
import { getLogger, generateRequestId } from './services/logger/index.js';
import { metrics } from './services/metrics/index.js';
import { runStartupVerification } from './services/startup/index.js';

const logger = getLogger({ module: 'worker' });

// L1 in-memory cache (survives within same worker instance)
let cachedBot: ReturnType<typeof createBot> | null = null;
let cachedToken: string | null = null;
const processedUpdates = new Map<string, number>(); // update_id -> timestamp
const UPDATE_CACHE_TTL = 300_000; // 5 minutes
let lastCleanup = Date.now();

// Lazy cleanup of old processed updates (runs on each request, max once per 5 min)
function cleanupProcessedUpdates() {
  const now = Date.now();
  if (now - lastCleanup < UPDATE_CACHE_TTL) return;
  lastCleanup = now;
  for (const [id, ts] of processedUpdates) {
    if (now - ts > UPDATE_CACHE_TTL) processedUpdates.delete(id);
  }
}

// Timing-safe comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Content-Type validation
const TELEGRAM_CONTENT_TYPE = 'application/json';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestId = generateRequestId();
    const url = new URL(request.url);
    const start = Date.now();

    // Lazy cleanup of dedup cache
    cleanupProcessedUpdates();

    // DIAGNOSTIC: Log every incoming request
    logger.info('REQUEST RECEIVED', {
      requestId,
      method: request.method,
      pathname: url.pathname,
      contentType: request.headers.get('content-type'),
      hasSecret: !!request.headers.get('X-Telegram-Bot-Api-Secret-Token'),
      userAgent: request.headers.get('user-agent')?.substring(0, 50),
    });

    // Health check endpoints
    if (request.method === 'GET') {
      if (url.pathname === '/health') {
        const report = await runStartupVerification(env);
        const errors = report.filter(c => c.status === 'error').length;
        return Response.json({
          status: errors > 0 ? 'degraded' : 'ok',
          bot: 'Ikol',
          version: '2.1.0',
          uptime: Date.now(),
          checks: report.length,
          errors,
          details: report.map(c => ({ name: c.name, status: c.status, message: c.message })),
        });
      }
      if (url.pathname === '/metrics') {
        const snap = metrics.getSnapshot();
        return Response.json({
          uptime: snap.uptime,
          requests: snap.requests,
          users: { active: snap.users.active.size, daily: snap.users.daily.size },
          providers: snap.providers,
          cache: snap.cache,
          errors: snap.errors.total,
        });
      }
      if (url.pathname === '/') {
        return new Response('Ikol Bot v2.0 is running!', { status: 200 });
      }
      return new Response('Not found', { status: 404 });
    }

    // DIAGNOSTIC: Test endpoint - simulate Telegram update
    if (request.method === 'GET' && url.pathname === '/test') {
      logger.info('TEST ENDPOINT HIT', { requestId });
      return Response.json({
        status: 'ok',
        message: 'Worker is reachable',
        timestamp: Date.now(),
        version: '2.1.0',
      });
    }

    // Only handle POST for Telegram webhooks
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Content-Type validation
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes(TELEGRAM_CONTENT_TYPE)) {
      return new Response('Invalid content type', { status: 415 });
    }

    // Webhook secret verification (timing-safe)
    if (env.BOT_WEBHOOK_SECRET) {
      const secretToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
      if (!secretToken || !safeCompare(secretToken, env.BOT_WEBHOOK_SECRET)) {
        logger.warn('Webhook unauthorized', { requestId, status: 'error' });
        return new Response('Unauthorized', { status: 401 });
      }
    }

    try {
      const botToken = env.BOT_TOKEN || (env as any).TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        logger.error('BOT_TOKEN not configured', { requestId });
        return Response.json({ error: 'Bot not configured' }, { status: 500 });
      }

      // Run startup verification on first request
      const startupReport = await runStartupVerification(env);
      const startupErrors = startupReport.filter(c => c.status === 'error');
      if (startupErrors.length > 0) {
        logger.warn('Startup has errors', {
          requestId,
          errors: startupErrors.map(e => `${e.name}: ${e.message}`),
        });
      }

      // Reuse bot instance
      if (!cachedBot || cachedToken !== botToken) {
        logger.info('Creating new bot instance', {
          requestId,
          hasToken: !!botToken,
          tokenPrefix: botToken.substring(0, 10),
        });
        cachedBot = createBot(botToken, env);
        cachedToken = botToken;
        logger.info('Bot instance created', { requestId });
      }

      const bot = cachedBot;

      // Set bot info from KV cache
      if (!bot.botInfo) {
        try {
          logger.info('Loading bot info', { requestId });
          const botInfoStr = await env.KV.get('bot_info');
          if (botInfoStr) {
            bot.botInfo = JSON.parse(botInfoStr);
            logger.info('Bot info loaded from KV', { requestId, botId: bot.botInfo?.id });
          } else {
            logger.info('Fetching bot info from Telegram', { requestId });
            const me = await bot.api.getMe();
            await env.KV.put('bot_info', JSON.stringify(me), { expirationTtl: 86400 });
            bot.botInfo = me;
            logger.info('Bot info fetched and cached', { requestId, botId: me.id, botUsername: me.username });
          }
        } catch (e) {
          logger.warn('Failed to load bot info', { requestId, error: (e as Error).message });
        }
      }

      // Parse update
      const body = await request.text();
      if (!body) return new Response('Empty body', { status: 400 });

      let update: any;
      try {
        update = JSON.parse(body);
      } catch {
        return new Response('Invalid JSON', { status: 400 });
      }

      // Deduplicate updates (Telegram may send same update twice)
      const updateId = update.update_id;
      if (updateId) {
        if (processedUpdates.has(updateId)) {
          logger.debug('Duplicate update', { requestId, updateId });
          return new Response('OK', { status: 200 });
        }
        processedUpdates.set(updateId, Date.now());
      }

      // Log update summary
      const updateType = update.message ? 'message' :
                         update.callback_query ? 'callback_query' :
                         update.inline_query ? 'inline_query' : 'other';
      const text = update.message?.text || update.callback_query?.data || '';
      const userId = update.message?.from?.id || update.callback_query?.from?.id;

      // Record metrics
      metrics.recordRequest(updateType, true);
      if (userId) metrics.recordUser(userId);

      logger.info('Update received', {
        requestId,
        updateId,
        userId,
        updateType,
        text: String(text).substring(0, 60),
      });

      // Process update
      logger.info('Processing update', {
        requestId,
        updateId,
        userId,
        updateType,
        text: String(text).substring(0, 60),
        hasMessage: !!update.message,
        hasCallback: !!update.callback_query,
        hasEntities: !!update.message?.entities,
        botTokenPrefix: botToken.substring(0, 10),
        botHasInfo: !!bot.botInfo,
      });

      try {
        await bot.handleUpdate(update);
        logger.info('handleUpdate completed', { requestId, updateId, userId });
      } catch (handleError) {
        logger.error('handleUpdate FAILED', {
          requestId,
          updateId,
          userId,
          error: (handleError as Error).message,
          stack: (handleError as Error).stack?.substring(0, 500),
        });
        throw handleError;
      }
      const duration = Date.now() - start;

      metrics.recordLatency('webhook', duration);

      logger.info('Update processed successfully', {
        requestId,
        updateId,
        userId,
        latency: duration,
        status: 'success',
      });

      return new Response('OK', { status: 200 });
    } catch (error) {
      const duration = Date.now() - start;
      metrics.recordRequest('error', false);
      metrics.recordError('worker', (error as Error).message);

      logger.error('FATAL: Update processing failed', {
        requestId,
        latency: duration,
        status: 'error',
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      // Always return 200 to Telegram to prevent retries
      return new Response('OK', { status: 200 });
    }
  },
};
