// Startup verification — checks all systems on first request
// Logs a comprehensive startup report

import type { Env } from '../../types/env.js';
import { getFeatureFlags } from '../feature-flags/index.js';
import { getRegisteredModules } from '../../bot/plugin-system.js';
import { getLogger } from '../logger/index.js';

const logger = getLogger({ module: 'startup' });

export interface StartupCheck {
  name: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
}

let startupDone = false;
let startupReport: StartupCheck[] = [];

export async function runStartupVerification(env: Env): Promise<StartupCheck[]> {
  if (startupDone) return startupReport;

  const checks: StartupCheck[] = [];

  // 1. Environment variables
  checks.push(check('BOT_TOKEN', env.BOT_TOKEN ? 'ok' : 'error', env.BOT_TOKEN ? 'Configured' : 'MISSING — bot will not work'));
  checks.push(check('BOT_WEBHOOK_SECRET', env.BOT_WEBHOOK_SECRET ? 'ok' : 'warn', env.BOT_WEBHOOK_SECRET ? 'Configured' : 'Not set — webhook verification disabled'));

  // 2. AI providers
  const aiProviders = [];
  if (env.GEMINI_API_KEY) aiProviders.push('Gemini');
  if (env.OPENAI_API_KEY) aiProviders.push('OpenAI');
  if (env.OPENROUTER_API_KEY) aiProviders.push('OpenRouter');
  if (env.ANTHROPIC_API_KEY) aiProviders.push('Claude');
  checks.push(check('AI Providers', aiProviders.length > 0 ? 'ok' : 'warn', aiProviders.length > 0 ? `${aiProviders.join(', ')}` : 'None configured'));

  // 3. Feature flags
  const flags = getFeatureFlags(env);
  const enabledCount = Object.values(flags).filter(v => v === true).length;
  const totalFlags = Object.keys(flags).length;
  checks.push(check('Feature Flags', 'ok', `${enabledCount}/${totalFlags} enabled`));

  // 4. Modules
  const modules = getRegisteredModules();
  checks.push(check('Modules', modules.length > 0 ? 'ok' : 'warn', `${modules.length} loaded: ${modules.map(m => m.name).join(', ')}`));

  // 5. Database
  try {
    if (env.DB) {
      await env.DB.prepare('SELECT 1 as ok').first();
      checks.push(check('Database', 'ok', 'D1 connected'));
    } else {
      checks.push(check('Database', 'error', 'D1 not bound'));
    }
  } catch (e) {
    checks.push(check('Database', 'error', `D1 error: ${(e as Error).message}`));
  }

  // 6. KV
  try {
    if (env.KV) {
      await env.KV.put('_health', 'ok', { expirationTtl: 60 });
      checks.push(check('KV', 'ok', 'KV connected'));
    } else {
      checks.push(check('KV', 'error', 'KV not bound'));
    }
  } catch (e) {
    checks.push(check('KV', 'error', `KV error: ${(e as Error).message}`));
  }

  // 7. Optional providers
  const optionalServices = [
    { name: 'Spotify', ok: !!(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET) },
    { name: 'Genius', ok: !!env.GENIUS_API_KEY },
    { name: 'Musixmatch', ok: !!env.MUSIXMATCH_API_KEY },
    { name: 'NASA', ok: !!env.NASA_API_KEY },
    { name: 'ExchangeRate', ok: !!env.EXCHANGERATE_API_KEY },
    { name: 'Steam', ok: !!env.STEAM_API_KEY },
  ];
  const configured = optionalServices.filter(s => s.ok).map(s => s.name);
  const missing = optionalServices.filter(s => !s.ok).map(s => s.name);
  checks.push(check('Optional Services', 'ok', configured.length > 0 ? `${configured.length} configured: ${configured.join(', ')}` : 'Using free defaults'));

  // Log the report
  const errors = checks.filter(c => c.status === 'error').length;
  const warnings = checks.filter(c => c.status === 'warn').length;

  logger.info('Startup verification complete', {
    errors,
    warnings,
    total: checks.length,
  });

  for (const c of checks) {
    const icon = c.status === 'ok' ? '✓' : c.status === 'warn' ? '⚠' : '✗';
    logger.info(`${icon} ${c.name}: ${c.message}`);
  }

  startupReport = checks;
  startupDone = true;
  return checks;
}

function check(name: string, status: 'ok' | 'warn' | 'error', message: string): StartupCheck {
  return { name, status, message };
}

export function getStartupReport(): StartupCheck[] {
  return startupReport;
}

export function isStartupDone(): boolean {
  return startupDone;
}
