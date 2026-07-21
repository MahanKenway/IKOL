// L1 in-memory cache + L2 KV cache with per-feature policies

import { getCachePolicy, type CachePolicy } from './policies.js';
import { metrics } from '../metrics/index.js';

interface CacheEntry<T> {
  value: T;
  expires: number;
}

export class TieredCache {
  private l1 = new Map<string, CacheEntry<any>>();
  private kv: KVNamespace | null;

  constructor(kv: KVNamespace | null) {
    this.kv = kv;
  }

  async get<T>(key: string, feature?: string): Promise<T | null> {
    // L1 check
    const l1Entry = this.l1.get(key);
    if (l1Entry && l1Entry.expires > Date.now()) {
      metrics.recordCacheHit();
      return l1Entry.value as T;
    }
    this.l1.delete(key);

    // L2 check (KV)
    if (!this.kv) {
      metrics.recordCacheMiss();
      return null;
    }
    try {
      const value = await this.kv.get(key, 'json');
      if (value !== null) {
        const policy = getCachePolicy(feature || 'default');
        this.l1.set(key, { value, expires: Date.now() + policy.l1TTL });
        metrics.recordCacheHit();
        return value as T;
      }
    } catch { /* ignore KV errors */ }

    metrics.recordCacheMiss();
    return null;
  }

  async set<T>(key: string, value: T, feature?: string, ttlSeconds?: number): Promise<void> {
    const policy = getCachePolicy(feature || 'default');
    const l1TTL = policy.l1TTL;
    const l2TTL = ttlSeconds ?? policy.l2TTL;

    // Set L1
    this.l1.set(key, { value, expires: Date.now() + l1TTL });

    // Set L2 (KV)
    if (this.kv) {
      try {
        await this.kv.put(key, JSON.stringify(value), { expirationTtl: l2TTL });
      } catch { /* ignore KV errors */ }
    }
  }

  async delete(key: string): Promise<void> {
    this.l1.delete(key);
    if (this.kv) {
      try { await this.kv.delete(key); } catch { /* ignore */ }
    }
  }

  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    feature?: string,
    ttlSeconds?: number
  ): Promise<{ data: T; cached: boolean }> {
    const cached = await this.get<T>(key, feature);
    if (cached !== null) return { data: cached, cached: true };

    const data = await fetcher();
    await this.set(key, data, feature, ttlSeconds);
    return { data, cached: false };
  }

  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: { feature?: string; ttlSeconds?: number }
  ): Promise<{ data: T; cached: boolean; stale: boolean }> {
    const cached = await this.get<T>(key, options?.feature);
    if (cached !== null) return { data: cached, cached: true, stale: false };

    const data = await fetcher();
    await this.set(key, data, options?.feature, options?.ttlSeconds);
    return { data, cached: false, stale: false };
  }

  getL1Size(): number {
    return this.l1.size;
  }

  clearL1(): void {
    this.l1.clear();
  }
}
