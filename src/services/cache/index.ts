export class CacheService {
  private kv: KVNamespace;
  private defaultTTL: number;

  constructor(kv: KVNamespace, defaultTTL: number = 300) {
    this.kv = kv;
    this.defaultTTL = defaultTTL;
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.kv.get(key, 'json');
    return value as T | null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.kv.put(key, JSON.stringify(value), {
      expirationTtl: ttl || this.defaultTTL,
    });
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const value = await this.kv.get(key);
    return value !== null;
  }

  // Cache with fallback
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

  // Pattern-based deletion
  async deletePattern(pattern: string): Promise<void> {
    const list = await this.kv.list({ prefix: pattern });
    const deletePromises = list.keys.map((key) => this.kv.delete(key.name));
    await Promise.all(deletePromises);
  }

  // Increment counter
  async increment(key: string, ttl?: number): Promise<number> {
    const value = await this.kv.get(key);
    const count = value ? parseInt(value, 10) + 1 : 1;
    await this.kv.put(key, count.toString(), {
      expirationTtl: ttl || this.defaultTTL,
    });
    return count;
  }
}
