import { describe, it, expect } from 'vitest';
import { getFeatureFlags, isFeatureEnabled } from '../src/services/feature-flags/index.js';
import type { Env } from '../src/types/env.js';

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    KV: {} as KVNamespace,
    ENVIRONMENT: 'test',
    BOT_TOKEN: 'test-token',
    BOT_WEBHOOK_SECRET: 'test-secret',
    ...overrides,
  } as Env;
}

describe('FeatureFlags', () => {
  it('should have all flags enabled by default', () => {
    const flags = getFeatureFlags(makeEnv());
    expect(flags.ai).toBe(true);
    expect(flags.downloader).toBe(true);
    expect(flags.music).toBe(true);
    expect(flags.finance).toBe(true);
    expect(flags.space).toBe(true);
    expect(flags.games).toBe(true);
    expect(flags.utilities).toBe(true);
    expect(flags.funCalendar).toBe(true);
  });

  it('should disable flags when set to "false"', () => {
    const env = makeEnv({ ENABLE_AI: 'false', ENABLE_MUSIC: 'false' });
    const flags = getFeatureFlags(env);
    expect(flags.ai).toBe(false);
    expect(flags.music).toBe(false);
    expect(flags.downloader).toBe(true);
  });

  it('should disable flags when set to "0"', () => {
    const env = makeEnv({ ENABLE_GAMES: '0' });
    const flags = getFeatureFlags(env);
    expect(flags.games).toBe(false);
  });

  it('should enable flags when set to "true"', () => {
    const env = makeEnv({ ENABLE_AI: 'true' });
    const flags = getFeatureFlags(env);
    expect(flags.ai).toBe(true);
  });

  it('should handle undefined values as enabled', () => {
    const env = makeEnv({});
    const flags = getFeatureFlags(env);
    expect(flags.ai).toBe(true);
    expect(flags.rateLimiting).toBe(true);
  });

  it('should support isFeatureEnabled helper', () => {
    const env = makeEnv({ ENABLE_AI: 'false' });
    expect(isFeatureEnabled(env, 'ai')).toBe(false);
    expect(isFeatureEnabled(env, 'downloader')).toBe(true);
  });

  it('should parse case-insensitive values', () => {
    const env = makeEnv({ ENABLE_AI: 'TRUE', ENABLE_MUSIC: 'Yes' });
    const flags = getFeatureFlags(env);
    expect(flags.ai).toBe(true);
    expect(flags.music).toBe(true);
  });
});
