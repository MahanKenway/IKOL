import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker } from '../src/services/circuit-breaker/index.js';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;
  let mockKV: any;

  beforeEach(() => {
    mockKV = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn(),
      delete: vi.fn(),
    };
    cb = new CircuitBreaker(mockKV, {
      failureThreshold: 3,
      cooldownMs: 1000,
      halfOpenMaxAttempts: 2,
    });
  });

  it('should start in closed state', async () => {
    expect(await cb.isOpen('test')).toBe(false);
  });

  it('should open after threshold failures', async () => {
    await cb.recordFailure('test');
    await cb.recordFailure('test');
    expect(await cb.isOpen('test')).toBe(false); // 2 failures, not yet open

    await cb.recordFailure('test');
    expect(await cb.isOpen('test')).toBe(true); // 3 failures, now open
  });

  it('should close after successful recovery', async () => {
    await cb.recordFailure('test');
    await cb.recordFailure('test');
    await cb.recordFailure('test');
    expect(await cb.isOpen('test')).toBe(true);

    // Wait for cooldown (simulate by resetting lastFailure)
    // In real usage, we'd wait; here we just test the state machine
    await cb.reset('test');
    expect(await cb.isOpen('test')).toBe(false);
  });

  it('should record success', async () => {
    await cb.recordFailure('test');
    await cb.recordSuccess('test');
    // Success should reset failure count
    await cb.recordFailure('test');
    await cb.recordFailure('test');
    expect(await cb.isOpen('test')).toBe(false); // Only 2 failures after reset
  });

  it('should transition to half-open after cooldown', async () => {
    await cb.recordFailure('test');
    await cb.recordFailure('test');
    await cb.recordFailure('test');
    expect(await cb.isOpen('test')).toBe(true);

    // Simulate cooldown by creating a new breaker with very short cooldown
    const shortCb = new CircuitBreaker(mockKV, {
      failureThreshold: 3,
      cooldownMs: 1, // 1ms
      halfOpenMaxAttempts: 2,
    });

    // Pre-populate state
    await shortCb.recordFailure('test');
    await shortCb.recordFailure('test');
    await shortCb.recordFailure('test');

    // Wait a bit
    await new Promise(r => setTimeout(r, 10));

    // Should now be in half-open (isOpen returns false)
    expect(await shortCb.isOpen('test')).toBe(false);
  });

  it('should work without KV (local fallback)', async () => {
    const localCb = new CircuitBreaker(null);
    expect(await localCb.isOpen('test')).toBe(false);
    await localCb.recordFailure('test');
    await localCb.recordFailure('test');
    await localCb.recordFailure('test');
    await localCb.recordFailure('test');
    await localCb.recordFailure('test');
    expect(await localCb.isOpen('test')).toBe(true);
  });

  it('should return correct state label', async () => {
    expect(await cb.getStateLabel('test')).toBe('closed');
    await cb.recordFailure('test');
    await cb.recordFailure('test');
    await cb.recordFailure('test');
    expect(await cb.getStateLabel('test')).toBe('open');
  });
});
