import { describe, it, expect } from 'vitest';

describe('Bot Configuration', () => {
  it('should have correct bot name', async () => {
    const { CONFIG } = await import('../src/config/index.js');
    expect(CONFIG.BOT_NAME).toBe('Ikol');
    expect(CONFIG.BOT_NAME_FA).toBe('ایکول');
  });

  it('should have correct version', async () => {
    const { CONFIG } = await import('../src/config/index.js');
    expect(CONFIG.VERSION).toBe('2.0.0');
  });

  it('should have all API endpoints', async () => {
    const { CONFIG } = await import('../src/config/index.js');
    expect(CONFIG.APIS.DEEZER).toBeDefined();
    expect(CONFIG.APIS.NASA).toBeDefined();
    expect(CONFIG.APIS.SPACEX).toBeDefined();
    expect(CONFIG.APIS.FRANKFURTER).toBeDefined();
  });

  it('should have correct cache TTLs', async () => {
    const { CONFIG } = await import('../src/config/index.js');
    expect(CONFIG.CACHE_TTL.SHORT).toBe(300);
    expect(CONFIG.CACHE_TTL.MEDIUM).toBe(1800);
    expect(CONFIG.CACHE_TTL.LONG).toBe(3600);
  });
});
