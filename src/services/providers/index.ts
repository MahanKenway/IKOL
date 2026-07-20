import { getLogger } from '../logger/index.js';

const logger = getLogger({ service: 'MultiProvider' });

// Generic provider interface with fallback support
export interface Provider<T> {
  name: string;
  priority: number;
  execute: (...args: any[]) => Promise<T>;
  isAvailable?: () => Promise<boolean>;
}

// Multi-provider executor with automatic fallback
export class MultiProvider<T> {
  private providers: Provider<T>[] = [];
  private cache = new Map<string, { data: T; timestamp: number }>();
  private cacheTTL = 300000; // 5 minutes

  addProvider(provider: Provider<T>): this {
    this.providers.push(provider);
    this.providers.sort((a, b) => a.priority - b.priority);
    return this;
  }

  async execute(
    operation: string,
    ...args: any[]
  ): Promise<{ data: T; provider: string; cached: boolean }> {
    // Check cache first
    const cacheKey = `${operation}:${JSON.stringify(args)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return { data: cached.data, provider: 'cache', cached: true };
    }

    // Try providers in priority order
    const errors: Error[] = [];

    for (const provider of this.providers) {
      try {
        // Check if provider is available
        if (provider.isAvailable) {
          const available = await provider.isAvailable();
          if (!available) {
            logger.debug(`Provider ${provider.name} not available, skipping`);
            continue;
          }
        }

        // Execute with timeout
        const result = await Promise.race([
          provider.execute(...args),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 30000)
          ),
        ]);

        // Cache successful result
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });

        logger.info(`Provider ${provider.name} succeeded for ${operation}`);
        return { data: result, provider: provider.name, cached: false };
      } catch (error) {
        const err = error as Error;
        errors.push(err);
        logger.warn(`Provider ${provider.name} failed: ${err.message}`);
      }
    }

    // All providers failed
    throw new Error(
      `All providers failed for ${operation}: ${errors.map((e) => e.message).join(', ')}`
    );
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Music Provider Chain
export interface MusicSearchResult {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  previewUrl?: string;
  coverUrl?: string;
  platform: string;
}

export interface LyricsResult {
  plainLyrics?: string;
  syncedLyrics?: string;
  source: string;
}

export interface ArtistInfo {
  name: string;
  image?: string;
  followers?: number;
  genres?: string[];
  bio?: string;
}

export interface AlbumInfo {
  title: string;
  artist: string;
  coverUrl?: string;
  releaseDate?: string;
  tracks: MusicSearchResult[];
}

// Finance Provider Chain
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

// Space Provider Chain
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

// Downloader Provider Chain
export interface DownloadResult {
  url: string;
  filename: string;
  mimeType: string;
  size?: number;
  quality?: string;
  platform: string;
}

// Provider Factory
export function createMusicProvider(): MultiProvider<MusicSearchResult[]> {
  return new MultiProvider<MusicSearchResult[]>();
}

export function createLyricsProvider(): MultiProvider<LyricsResult> {
  return new MultiProvider<LyricsResult>();
}

export function createFinanceProvider(): MultiProvider<CurrencyRate[]> {
  return new MultiProvider<CurrencyRate[]>();
}

export function createSpaceProvider(): MultiProvider<ApodData> {
  return new MultiProvider<ApodData>();
}

export function createDownloaderProvider(): MultiProvider<DownloadResult> {
  return new MultiProvider<DownloadResult>();
}
