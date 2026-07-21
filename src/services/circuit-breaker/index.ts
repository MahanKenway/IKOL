// Circuit breaker with KV-backed state for cross-worker persistence
// States: closed (normal) -> open (failing) -> half-open (testing)

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;    // failures before opening
  cooldownMs: number;          // time before half-open
  halfOpenMaxAttempts: number; // successful attempts to close
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  cooldownMs: 60_000,       // 1 minute
  halfOpenMaxAttempts: 2,
};

interface CircuitStateData {
  state: CircuitState;
  failures: number;
  lastFailure: number;
  halfOpenAttempts: number;
}

export class CircuitBreaker {
  private kv: KVNamespace | null;
  private config: CircuitBreakerConfig;
  // In-memory fallback when KV unavailable
  private localState = new Map<string, CircuitStateData>();

  constructor(kv: KVNamespace | null, config?: Partial<CircuitBreakerConfig>) {
    this.kv = kv;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private async getState(name: string): Promise<CircuitStateData> {
    // Try KV first
    if (this.kv) {
      try {
        const raw = await this.kv.get(`cb:${name}`, 'json');
        if (raw) return raw as CircuitStateData;
      } catch { /* fall through to local */ }
    }
    // Local fallback
    return this.localState.get(name) || { state: 'closed', failures: 0, lastFailure: 0, halfOpenAttempts: 0 };
  }

  private async setState(name: string, data: CircuitStateData) {
    this.localState.set(name, data);
    if (this.kv) {
      try {
        await this.kv.put(`cb:${name}`, JSON.stringify(data), { expirationTtl: 300 });
      } catch { /* local state still works */ }
    }
  }

  async isOpen(name: string): Promise<boolean> {
    const s = await this.getState(name);
    if (s.state === 'closed') return false;
    if (s.state === 'open') {
      // Check if cooldown expired -> transition to half-open
      if (Date.now() - s.lastFailure > this.config.cooldownMs) {
        await this.setState(name, { ...s, state: 'half-open', halfOpenAttempts: 0 });
        return false;
      }
      return true;
    }
    // half-open: allow requests
    return false;
  }

  async recordSuccess(name: string) {
    const s = await this.getState(name);
    if (s.state === 'half-open') {
      const attempts = s.halfOpenAttempts + 1;
      if (attempts >= this.config.halfOpenMaxAttempts) {
        // Enough successes -> close circuit
        await this.setState(name, { state: 'closed', failures: 0, lastFailure: 0, halfOpenAttempts: 0 });
      } else {
        await this.setState(name, { ...s, halfOpenAttempts: attempts });
      }
    } else {
      // Reset failure count on success
      await this.setState(name, { state: 'closed', failures: 0, lastFailure: 0, halfOpenAttempts: 0 });
    }
  }

  async recordFailure(name: string) {
    const s = await this.getState(name);
    const failures = s.failures + 1;
    if (failures >= this.config.failureThreshold) {
      await this.setState(name, { state: 'open', failures, lastFailure: Date.now(), halfOpenAttempts: 0 });
    } else {
      await this.setState(name, { ...s, failures, lastFailure: Date.now() });
    }
  }

  async getStateLabel(name: string): Promise<CircuitState> {
    const s = await this.getState(name);
    if (s.state === 'open' && Date.now() - s.lastFailure > this.config.cooldownMs) {
      return 'half-open';
    }
    return s.state;
  }

  async reset(name: string) {
    await this.setState(name, { state: 'closed', failures: 0, lastFailure: 0, halfOpenAttempts: 0 });
  }
}
