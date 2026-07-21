import type { ImageProvider, ImageSearchOptions, ImageSearchResult } from '../types.js';
import { CircuitBreaker } from '../../circuit-breaker/index.js';
import { getLogger } from '../../logger/index.js';

const logger = getLogger({ service: 'ImageSearch' });

export interface ImageProviderMetrics {
  name: string;
  totalCalls: number;
  successes: number;
  failures: number;
  avgLatencyMs: number;
  lastSuccess: number;
  lastFailure: number;
  circuitState: string;
}

export class ImageProviderRegistry {
  private providers: ImageProvider[] = [];
  private circuitBreaker: CircuitBreaker;
  private metrics = new Map<string, {
    total: number;
    successes: number;
    failures: number;
    totalLatency: number;
    lastSuccess: number;
    lastFailure: number;
  }>();

  constructor(kv: KVNamespace | null) {
    this.circuitBreaker = new CircuitBreaker(kv);
  }

  addProvider(provider: ImageProvider): this {
    this.providers.push(provider);
    this.providers.sort((a, b) => a.priority - b.priority);
    return this;
  }

  private initMetrics(name: string) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        total: 0,
        successes: 0,
        failures: 0,
        totalLatency: 0,
        lastSuccess: 0,
        lastFailure: 0,
      });
    }
  }

  async search(
    query: string,
    options: ImageSearchOptions
  ): Promise<{ results: ImageSearchResult[]; provider: string }> {
    const errors: string[] = [];

    for (const provider of this.providers) {
      if (await this.circuitBreaker.isOpen(provider.name)) {
        logger.debug(`Provider ${provider.name} circuit open, skipping`);
        continue;
      }

      const available = await provider.isAvailable().catch(() => false);
      if (!available) continue;

      this.initMetrics(provider.name);
      const m = this.metrics.get(provider.name)!;
      const start = Date.now();

      try {
        const results = await Promise.race([
          provider.search(query, options),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout after 15s')), 15000)
          ),
        ]);

        const latency = Date.now() - start;
        m.total++;
        m.successes++;
        m.totalLatency += latency;
        m.lastSuccess = Date.now();
        await this.circuitBreaker.recordSuccess(provider.name);

        logger.info(`Image search succeeded with ${provider.name}`, {
          provider: provider.name,
          latency,
          resultCount: results.length,
        });

        return { results, provider: provider.name };
      } catch (error) {
        const latency = Date.now() - start;
        const msg = (error as Error).message;
        m.total++;
        m.failures++;
        m.totalLatency += latency;
        m.lastFailure = Date.now();
        await this.circuitBreaker.recordFailure(provider.name);

        errors.push(`${provider.name}: ${msg}`);
        logger.warn(`Provider ${provider.name} failed`, {
          provider: provider.name,
          latency,
          error: msg,
        });
      }
    }

    throw new Error(`All image search providers failed: ${errors.join('; ')}`);
  }

  async getMetrics(): Promise<ImageProviderMetrics[]> {
    const results: ImageProviderMetrics[] = [];
    for (const [name, m] of this.metrics) {
      results.push({
        name,
        totalCalls: m.total,
        successes: m.successes,
        failures: m.failures,
        avgLatencyMs: m.total > 0 ? Math.round(m.totalLatency / m.total) : 0,
        lastSuccess: m.lastSuccess,
        lastFailure: m.lastFailure,
        circuitState: await this.circuitBreaker.getStateLabel(name),
      });
    }
    return results;
  }
}
