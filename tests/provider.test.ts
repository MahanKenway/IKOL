import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MultiProvider } from '../src/services/providers/index.js';

describe('MultiProvider', () => {
  let provider: MultiProvider<string>;

  beforeEach(() => {
    provider = new MultiProvider<string>(null);
  });

  it('should execute first provider successfully', async () => {
    provider.addProvider({
      name: 'primary',
      priority: 1,
      execute: async () => 'primary result',
    });

    const result = await provider.execute('test');
    expect(result.data).toBe('primary result');
    expect(result.provider).toBe('primary');
  });

  it('should fallback to second provider on failure', async () => {
    provider.addProvider({
      name: 'failing',
      priority: 1,
      execute: async () => { throw new Error('fail'); },
    });
    provider.addProvider({
      name: 'fallback',
      priority: 2,
      execute: async () => 'fallback result',
    });

    const result = await provider.execute('test');
    expect(result.data).toBe('fallback result');
    expect(result.provider).toBe('fallback');
  });

  it('should throw when all providers fail', async () => {
    provider.addProvider({
      name: 'failing1',
      priority: 1,
      execute: async () => { throw new Error('fail1'); },
    });
    provider.addProvider({
      name: 'failing2',
      priority: 2,
      execute: async () => { throw new Error('fail2'); },
    });

    await expect(provider.execute('test')).rejects.toThrow('All providers failed');
  });

  it('should skip unavailable providers', async () => {
    provider.addProvider({
      name: 'unavailable',
      priority: 1,
      execute: async () => 'should not reach',
      isAvailable: async () => false,
    });
    provider.addProvider({
      name: 'available',
      priority: 2,
      execute: async () => 'available result',
    });

    const result = await provider.execute('test');
    expect(result.data).toBe('available result');
    expect(result.provider).toBe('available');
  });

  it('should track metrics', async () => {
    provider.addProvider({
      name: 'test-provider',
      priority: 1,
      execute: async () => 'result',
    });

    await provider.execute('test');
    await provider.execute('test');

    const metrics = await provider.getMetrics();
    expect(metrics.length).toBe(1);
    expect(metrics[0].name).toBe('test-provider');
    expect(metrics[0].totalCalls).toBe(2);
    expect(metrics[0].successes).toBe(2);
    expect(metrics[0].failures).toBe(0);
  });

  it('should timeout after 15 seconds', async () => {
    provider.addProvider({
      name: 'slow',
      priority: 1,
      execute: async () => {
        await new Promise(r => setTimeout(r, 20000));
        return 'slow result';
      },
    });

    await expect(provider.execute('test')).rejects.toThrow();
  }, 20000);

  it('should sort providers by priority', async () => {
    provider.addProvider({
      name: 'low-priority',
      priority: 10,
      execute: async () => 'low',
    });
    provider.addProvider({
      name: 'high-priority',
      priority: 1,
      execute: async () => 'high',
    });

    const result = await provider.execute('test');
    expect(result.data).toBe('high');
    expect(result.provider).toBe('high-priority');
  });
});
