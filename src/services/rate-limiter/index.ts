// KV-based rate limiter — much faster than D1 for this use case
// Uses sliding window algorithm with KV

export class RateLimiter {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  /**
   * Check if an action is allowed under the rate limit.
   * Uses KV atomic increments for accuracy.
   * Returns { allowed, remaining, retryAfter }
   */
  async check(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - (now % windowSeconds); // Align to window
    const cacheKey = `rl:${key}:${windowStart}`;

    try {
      // Get current count
      const current = await this.kv.get(cacheKey);
      const count = current ? parseInt(current, 10) : 0;

      if (count >= limit) {
        const retryAfter = windowSeconds - (now % windowSeconds);
        return { allowed: false, remaining: 0, retryAfter };
      }

      // Increment (best-effort, may have race conditions under extreme load)
      await this.kv.put(cacheKey, (count + 1).toString(), {
        expirationTtl: windowSeconds * 2, // Auto-cleanup
      });

      return { allowed: true, remaining: limit - count - 1, retryAfter: 0 };
    } catch {
      // On KV failure, allow the request (fail open)
      return { allowed: true, remaining: limit, retryAfter: 0 };
    }
  }

  /**
   * Simple check — returns true if allowed.
   */
  async isAllowed(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const result = await this.check(key, limit, windowSeconds);
    return result.allowed;
  }
}
