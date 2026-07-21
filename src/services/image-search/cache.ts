import type { ImageSearchResult, ImageSearchCacheEntry } from './types.js';
import { getLogger } from '../logger/index.js';

const logger = getLogger({ service: 'ImageSearch' });

const CACHE_TTL = 6 * 60 * 60; // 6 hours in seconds
const CACHE_PREFIX = 'img:';

export class ImageSearchCache {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  private hashQuery(query: string, options: Record<string, unknown>): string {
    const str = JSON.stringify({ query: query.toLowerCase().trim(), ...options });
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36).slice(0, 12);
  }

  private getCacheKey(query: string, options: Record<string, unknown>): string {
    const hash = this.hashQuery(query, options);
    return `${CACHE_PREFIX}${hash}`;
  }

  async get(
    query: string,
    page: number
  ): Promise<ImageSearchCacheEntry | null> {
    const key = this.getCacheKey(query, { page });

    try {
      const raw = await this.kv.get(key, 'json');
      if (!raw) return null;

      const entry = raw as ImageSearchCacheEntry;
      const age = Date.now() - entry.timestamp;

      if (age > CACHE_TTL * 1000) {
        await this.kv.delete(key);
        return null;
      }

      return entry;
    } catch (error) {
      logger.warn('Image cache get failed', {
        error: (error as Error).message,
      });
      return null;
    }
  }

  async set(
    query: string,
    page: number,
    results: ImageSearchResult[],
    provider: string,
    totalResults: number
  ): Promise<void> {
    const key = this.getCacheKey(query, { page });

    const entry: ImageSearchCacheEntry = {
      results,
      provider,
      timestamp: Date.now(),
      metadata: {
        totalResults,
        query,
        page,
      },
    };

    try {
      await this.kv.put(key, JSON.stringify(entry), {
        expirationTtl: CACHE_TTL,
      });
    } catch (error) {
      logger.warn('Image cache set failed', {
        error: (error as Error).message,
      });
    }
  }

  async invalidate(query: string): Promise<void> {
    const prefix = this.getCacheKey(query, {});

    try {
      const list = await this.kv.list({ prefix: prefix.slice(0, -6) });
      await Promise.all(list.keys.map((k) => this.kv.delete(k.name)));
    } catch (error) {
      logger.warn('Image cache invalidate failed', {
        error: (error as Error).message,
      });
    }
  }
}
