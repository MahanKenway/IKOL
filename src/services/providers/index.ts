// MultiProvider with circuit breaker, latency tracking, and smart routing

import { CircuitBreaker } from '../circuit-breaker/index.js';
import { getLogger } from '../logger/index.js';

const logger = getLogger({ module: 'provider' });

export interface Provider<T> {
  name: string;
  priority: number;
  execute: (...args: any[]) => Promise<T>;
  isAvailable?: () => Promise<boolean>;
}

export interface ProviderMetrics {
  name: string;
  totalCalls: number;
  successes: number;
  failures: number;
  avgLatencyMs: number;
  lastSuccess: number;
  lastFailure: number;
  circuitState: string;
}

export class MultiProvider<T> {
  private providers: Provider<T>[] = [];
  private circuitBreaker: CircuitBreaker;
  private metrics = new Map<string, {
    total: number;
    successes: number;
    failures: number;
    totalLatency: number;
    lastSuccess: number;
    lastFailure: number;
  }>();

  constructor(kv?: KVNamespace | null) {
    this.circuitBreaker = new CircuitBreaker(kv || null);
  }

  addProvider(provider: Provider<T>): this {
    this.providers.push(provider);
    this.providers.sort((a, b) => a.priority - b.priority);
    return this;
  }

  private initMetrics(name: string) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, { total: 0, successes: 0, failures: 0, totalLatency: 0, lastSuccess: 0, lastFailure: 0 });
    }
  }

  async execute(operation: string, ...args: any[]): Promise<{ data: T; provider: string; cached: boolean }> {
    const errors: string[] = [];

    for (const provider of this.providers) {
      // Check circuit breaker
      if (await this.circuitBreaker.isOpen(provider.name)) {
        logger.debug(`Provider ${provider.name} circuit open, skipping`, { module: operation });
        continue;
      }

      // Check availability
      if (provider.isAvailable) {
        try {
          if (!(await provider.isAvailable())) continue;
        } catch { continue; }
      }

      this.initMetrics(provider.name);
      const m = this.metrics.get(provider.name)!;
      const start = Date.now();

      try {
        const result = await Promise.race([
          provider.execute(...args),
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

        logger.info(`Provider ${provider.name} succeeded`, {
          module: operation,
          provider: provider.name,
          latency,
          status: 'success',
        });

        return { data: result as T, provider: provider.name, cached: false };
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
          module: operation,
          provider: provider.name,
          latency,
          status: 'error',
          error: msg,
        });
      }
    }

    throw new Error(`All providers failed for ${operation}: ${errors.join('; ')}`);
  }

  async getMetrics(): Promise<ProviderMetrics[]> {
    const results: ProviderMetrics[] = [];
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

// Domain types
export interface MusicSearchResult {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  previewUrl?: string;
  coverUrl?: string;
  platform: string;
  // Extended metadata
  trackNumber?: number;
  discNumber?: number;
  releaseDate?: string;
  genre?: string;
  isrc?: string;
  explicit?: boolean;
  bpm?: number;
  gain?: number;
  // Quality options available
  qualities?: QualityOption[];
  // Source URLs
  sourceUrl?: string;
  // Artist info
  artistId?: string;
  artistUrl?: string;
  // Album info
  albumId?: string;
  albumUrl?: string;
}

export interface QualityOption {
  format: 'mp3' | 'flac' | 'aac' | 'ogg';
  bitrate: number; // kbps
  label: string; // e.g. "MP3 320kbps"
  available: boolean;
}

export interface MusicAlbum {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  coverUrl?: string;
  releaseDate?: string;
  trackCount: number;
  duration: number; // total seconds
  genre?: string;
  platform: string;
  sourceUrl?: string;
  tracks?: MusicSearchResult[];
}

export interface MusicArtist {
  id: string;
  name: string;
  pictureUrl?: string;
  fanCount?: number;
  albumCount?: number;
  trackCount?: number;
  platform: string;
  sourceUrl?: string;
}

export interface MusicPlaylist {
  id: string;
  title: string;
  description?: string;
  creator?: string;
  coverUrl?: string;
  trackCount: number;
  duration: number;
  platform: string;
  sourceUrl?: string;
  tracks?: MusicSearchResult[];
}

export interface LyricsResult {
  plainLyrics?: string;
  syncedLyrics?: string;
  source: string;
}

export interface CurrencyRate {
  from: string;
  to: string;
  rate: number;
  timestamp: number;
  source: string;
}

export interface GoldPrice {
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
  source: string;
  metal?: string;
}

export interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
  source: string;
}

export interface ApodData {
  date: string;
  title: string;
  explanation: string;
  url: string;
  hdurl?: string;
  mediaType: 'image' | 'video';
  copyright?: string;
}

export interface LaunchData {
  id: string;
  name: string;
  date: string;
  success: boolean;
  details?: string;
  rocket: string;
  imageUrl?: string;
}

export interface DownloadResult {
  url: string;
  filename: string;
  mimeType: string;
  size?: number;
  quality?: string;
  platform: string;
}
