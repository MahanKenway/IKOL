import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CacheService } from '../src/services/cache/index.js';

describe('CacheService', () => {
  let cache: CacheService;
  let mockKV: any;

  beforeEach(() => {
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    };
    cache = new CacheService(mockKV, 300);
  });

  describe('get', () => {
    it('should return null for non-existent key', async () => {
      mockKV.get.mockResolvedValue(null);
      const result = await cache.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should return parsed JSON for existing key', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify({ foo: 'bar' }));
      const result = await cache.get('existing');
      expect(result).toEqual({ foo: 'bar' });
    });
  });

  describe('set', () => {
    it('should store value with default TTL', async () => {
      await cache.set('key', { data: 'value' });
      expect(mockKV.put).toHaveBeenCalledWith(
        'key',
        JSON.stringify({ data: 'value' }),
        { expirationTtl: 300 }
      );
    });

    it('should store value with custom TTL', async () => {
      await cache.set('key', { data: 'value' }, 600);
      expect(mockKV.put).toHaveBeenCalledWith(
        'key',
        JSON.stringify({ data: 'value' }),
        { expirationTtl: 600 }
      );
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify({ cached: true }));
      const result = await cache.getOrSet('key', async () => ({ fresh: true }));
      expect(result.data).toEqual({ cached: true });
      expect(result.cached).toBe(true);
    });

    it('should fetch and cache if not exists', async () => {
      mockKV.get.mockResolvedValue(null);
      const fetcher = vi.fn().mockResolvedValue({ fresh: true });
      const result = await cache.getOrSet('key', fetcher);
      expect(result.data).toEqual({ fresh: true });
      expect(result.cached).toBe(false);
      expect(fetcher).toHaveBeenCalled();
      expect(mockKV.put).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete key', async () => {
      await cache.delete('key');
      expect(mockKV.delete).toHaveBeenCalledWith('key');
    });
  });

  describe('has', () => {
    it('should return true if key exists', async () => {
      mockKV.get.mockResolvedValue('value');
      const result = await cache.has('key');
      expect(result).toBe(true);
    });

    it('should return false if key does not exist', async () => {
      mockKV.get.mockResolvedValue(null);
      const result = await cache.has('key');
      expect(result).toBe(false);
    });
  });
});
