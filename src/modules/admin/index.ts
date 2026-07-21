import { Composer, type Context } from 'grammy';
import { metrics } from '../../services/metrics/index.js';
import { getFeatureFlags } from '../../services/feature-flags/index.js';
import { getAllPolicies as getAllCachePolicies } from '../../services/cache/policies.js';
import { getRegisteredModules } from '../../bot/plugin-system.js';
import { getLogger } from '../../services/logger/index.js';
import type { Env } from '../../types/env.js';
import type { FeatureFlags } from '../../services/feature-flags/index.js';
import type { IkolModule } from '../../bot/plugin-system.js';
import { registerModule } from '../../bot/plugin-system.js';

const logger = getLogger({ module: 'admin' });

// Owner ID — set via env or hardcoded for now
const OWNER_IDS = new Set<number>();

function isOwner(userId: number, env: Env): boolean {
  // Check env var for owner IDs (comma-separated)
  if (OWNER_IDS.size === 0 && env.OWNER_IDS) {
    env.OWNER_IDS.split(',').forEach(id => {
      const num = parseInt(id.trim(), 10);
      if (!isNaN(num)) OWNER_IDS.add(num);
    });
  }
  return OWNER_IDS.has(userId);
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

function createAdminModule(): IkolModule {
  return {
    name: 'admin',
    featureFlag: 'ai', // Always enabled if bot is running
    version: '2.0.0',
    register(composer: Composer<Context>, env: Env, flags: FeatureFlags) {

      // /health — Quick health check
      composer.command('health', async (ctx) => {
        if (!isOwner(ctx.from!.id, env)) {
          await ctx.reply('Access denied.');
          return;
        }
        const snap = metrics.getSnapshot();
        const dbOk = !!(ctx as any).db;
        const kvOk = !!(ctx as any).cache;
        const hasAi = !!(env.GEMINI_API_KEY || env.OPENAI_API_KEY || env.OPENROUTER_API_KEY);

        const lines = [
          'Health Check',
          `${'─'.repeat(28)}`,
          `Bot: OK`,
          `DB: ${dbOk ? 'OK' : 'UNAVAILABLE'}`,
          `KV: ${kvOk ? 'OK' : 'UNAVAILABLE'}`,
          `AI: ${hasAi ? 'CONFIGURED' : 'NOT CONFIGURED'}`,
          `Uptime: ${formatUptime(snap.uptime)}`,
          `Errors: ${snap.errors.total}`,
        ];
        await ctx.reply(lines.join('\n'));
      });

      // /stats — Detailed statistics
      composer.command('stats', async (ctx) => {
        if (!isOwner(ctx.from!.id, env)) {
          await ctx.reply('Access denied.');
          return;
        }
        const db = (ctx as any).db;
        if (db) {
          try {
            const dbStats = await db.getStats();
            const report = metrics.formatReport();
            await ctx.reply(`${report}\n\nDatabase:\n  Users: ${dbStats.totalUsers}\n  Messages: ${dbStats.totalMessages}\n  Downloads: ${dbStats.totalDownloads}`);
            return;
          } catch {}
        }
        await ctx.reply(metrics.formatReport());
      });

      // /providers — Provider health
      composer.command('providers', async (ctx) => {
        if (!isOwner(ctx.from!.id, env)) {
          await ctx.reply('Access denied.');
          return;
        }
        const snap = metrics.getSnapshot();
        const lines = ['Provider Status', `${'─'.repeat(28)}`];

        if (Object.keys(snap.providers).length === 0) {
          lines.push('No provider calls recorded yet.');
        } else {
          for (const [name, m] of Object.entries(snap.providers)) {
            const rate = m.calls > 0 ? ((m.successes / m.calls) * 100).toFixed(0) : '0';
            const status = m.failures > 0 && (Date.now() - m.lastFailure < 60_000) ? 'DEGRADED' : 'OK';
            lines.push(`${name}: ${status}`);
            lines.push(`  Calls: ${m.calls} | Success: ${rate}% | Avg: ${m.avgLatencyMs}ms`);
          }
        }
        await ctx.reply(lines.join('\n'));
      });

      // /cache — Cache stats
      composer.command('cache', async (ctx) => {
        if (!isOwner(ctx.from!.id, env)) {
          await ctx.reply('Access denied.');
          return;
        }
        const snap = metrics.getSnapshot();
        const cache = (ctx as any).cache;
        const l1Size = cache?.getL1Size?.() || 0;
        const policies = getAllCachePolicies();

        const lines = [
          'Cache Status',
          `${'─'.repeat(28)}`,
          `L1 entries: ${l1Size}`,
          `Hit ratio: ${(snap.cache.hitRatio * 100).toFixed(1)}%`,
          `Hits: ${snap.cache.hits} | Misses: ${snap.cache.misses}`,
          '',
          'Policies:',
        ];
        for (const [feature, policy] of Object.entries(policies)) {
          lines.push(`  ${feature}: L1=${policy.l1TTL / 1000}s L2=${policy.l2TTL}s`);
        }
        await ctx.reply(lines.join('\n'));
      });

      // /errors — Recent errors
      composer.command('errors', async (ctx) => {
        if (!isOwner(ctx.from!.id, env)) {
          await ctx.reply('Access denied.');
          return;
        }
        const snap = metrics.getSnapshot();
        if (snap.errors.recent.length === 0) {
          await ctx.reply('No recent errors.');
          return;
        }
        const lines = ['Recent Errors', `${'─'.repeat(28)}`];
        for (const err of snap.errors.recent.slice(-10)) {
          lines.push(`[${err.ts.split('T')[1]?.split('.')[0]}] ${err.module}: ${err.message}`);
        }
        await ctx.reply(lines.join('\n'));
      });

      // /runtime — Runtime info
      composer.command('runtime', async (ctx) => {
        if (!isOwner(ctx.from!.id, env)) {
          await ctx.reply('Access denied.');
          return;
        }
        const snap = metrics.getSnapshot();
        const modules = getRegisteredModules();
        const lines = [
          'Runtime',
          `${'─'.repeat(28)}`,
          `Version: 2.0.0`,
          `Environment: ${env.ENVIRONMENT || 'unknown'}`,
          `Uptime: ${formatUptime(snap.uptime)}`,
          `Modules: ${modules.length}`,
          `Feature flags:`,
        ];
        const flags = getFeatureFlags(env);
        for (const [key, value] of Object.entries(flags)) {
          lines.push(`  ${key}: ${value ? 'ON' : 'OFF'}`);
        }
        await ctx.reply(lines.join('\n'));
      });

      // /metrics — Raw metrics
      composer.command('metrics', async (ctx) => {
        if (!isOwner(ctx.from!.id, env)) {
          await ctx.reply('Access denied.');
          return;
        }
        const snap = metrics.getSnapshot();
        // Remove large arrays for display
        const display = {
          ...snap,
          latency: {
            webhook: snap.latency.webhook.length,
            ai: snap.latency.ai.length,
            download: snap.latency.download.length,
            music: snap.latency.music.length,
            database: snap.latency.database.length,
            kv: snap.latency.kv.length,
          },
          users: {
            active: snap.users.active.size,
            daily: snap.users.daily.size,
          },
        };
        await ctx.reply(JSON.stringify(display, null, 2));
      });

      // /modules — List loaded modules
      composer.command('modules', async (ctx) => {
        if (!isOwner(ctx.from!.id, env)) {
          await ctx.reply('Access denied.');
          return;
        }
        const modules = getRegisteredModules();
        const lines = ['Loaded Modules', `${'─'.repeat(28)}`];
        for (const mod of modules) {
          const flag = flags[mod.featureFlag] ? 'ON' : 'OFF';
          lines.push(`${mod.name} v${mod.version} [${flag}]`);
        }
        await ctx.reply(lines.join('\n'));
      });
    },
  };
}

registerModule(createAdminModule());

const bot = new Composer();
export default bot;
