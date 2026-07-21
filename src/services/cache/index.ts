import { getLogger } from '../logger/index.js';

const logger = getLogger({ service: 'Cache' });

export class CacheService {
  private kv: KVNamespace;
  private defaultTTL: number;

  constructor(kv: KVNamespace, defaultTTL: number = 300) {
    this.kv = kv;
    this.defaultTTL = defaultTTL;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.kv.get(key, 'json');
      return value as T | null;
    } catch (error) {
      logger.warn('Cache get failed', { key, error: (error as Error).message });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.kv.put(key, JSON.stringify(value), {
        expirationTtl: ttl || this.defaultTTL,
      });
    } catch (error) {
      logger.warn('Cache set failed', { key, error: (error as Error).message });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.kv.delete(key);
    } catch (error) {
      logger.warn('Cache delete failed', { key, error: (error as Error).message });
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const value = await this.kv.get(key);
      return value !== null;
    } catch {
      return false;
    }
  }

  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<{ data: T; cached: boolean }> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return { data: cached, cached: true };
    }

    const data = await fetcher();
    await this.set(key, data, ttl);
    return { data, cached: false };
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      let cursor: string | undefined;
      do {
        const result = await this.kv.list({ prefix: pattern, cursor });
        const deletePromises = result.keys.map((key) => this.kv.delete(key.name));
        await Promise.all(deletePromises);
        cursor = result.list_complete ? undefined : result.cursor;
      } while (cursor);
    } catch (error) {
      logger.warn('Cache deletePattern failed', { pattern, error: (error as Error).message });
    }
  }

  async increment(key: string, ttl?: number): Promise<number> {
    try {
      const value = await this.kv.get(key);
      const count = value ? parseInt(value, 10) + 1 : 1;
      await this.kv.put(key, count.toString(), {
        expirationTtl: ttl || this.defaultTTL,
      });
      return count;
    } catch (error) {
      logger.warn('Cache increment failed', { key, error: (error as Error).message });
      return 0;
    }
  }
}
