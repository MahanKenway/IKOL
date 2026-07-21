import type { Env } from '../../types/env.js';

export interface FeatureFlags {
  ai: boolean;
  downloader: boolean;
  music: boolean;
  finance: boolean;
  space: boolean;
  games: boolean;
  utilities: boolean;
  funCalendar: boolean;
  imageSearch: boolean;
  rateLimiting: boolean;
  webhookAutoSet: boolean;
  aiFallback: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  ai: true,
  downloader: true,
  music: true,
  finance: true,
  space: true,
  games: true,
  utilities: true,
  funCalendar: true,
  imageSearch: true,
  rateLimiting: true,
  webhookAutoSet: false,
  aiFallback: true,
};

function isEnabled(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  const v = value.toLowerCase().trim();
  return v === 'true' || v === '1' || v === 'yes';
}

export function getFeatureFlags(env: Env): FeatureFlags {
  return {
    ai: isEnabled(env.ENABLE_AI, DEFAULT_FLAGS.ai),
    downloader: isEnabled(env.ENABLE_DOWNLOADER, DEFAULT_FLAGS.downloader),
    music: isEnabled(env.ENABLE_MUSIC, DEFAULT_FLAGS.music),
    finance: isEnabled(env.ENABLE_FINANCE, DEFAULT_FLAGS.finance),
    space: isEnabled(env.ENABLE_SPACE, DEFAULT_FLAGS.space),
    games: isEnabled(env.ENABLE_GAMES, DEFAULT_FLAGS.games),
    utilities: isEnabled(env.ENABLE_UTILITIES, DEFAULT_FLAGS.utilities),
    funCalendar: isEnabled(env.ENABLE_FUN_CALENDAR, DEFAULT_FLAGS.funCalendar),
    imageSearch: isEnabled(env.ENABLE_IMAGE_SEARCH, DEFAULT_FLAGS.imageSearch),
    rateLimiting: isEnabled(env.RATE_LIMIT_ENABLED, DEFAULT_FLAGS.rateLimiting),
    webhookAutoSet: isEnabled(env.WEBHOOK_AUTO_SET, DEFAULT_FLAGS.webhookAutoSet),
    aiFallback: isEnabled(env.AI_FALLBACK_ENABLED, DEFAULT_FLAGS.aiFallback),
  };
}

export function isFeatureEnabled(env: Env, feature: keyof FeatureFlags): boolean {
  return getFeatureFlags(env)[feature];
}
