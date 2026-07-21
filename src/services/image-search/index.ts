import type { ImageSearchOptions, ImageSearchResult, ImageSearchConfig } from './types.js';
import { ImageProviderRegistry } from './providers/index.js';
import { PinterestProvider } from './providers/pinterest.js';
import { PexelsProvider } from './providers/pexels.js';
import { PixabayProvider } from './providers/pixabay.js';
import { UnsplashProvider } from './providers/unsplash.js';
import { WikimediaProvider } from './providers/wikimedia.js';
import { ImageSearchCache } from './cache.js';
import { validateQuery, sanitizeResults, checkSafeSearch } from './security.js';
import { getLogger } from '../logger/index.js';

const logger = getLogger({ service: 'ImageSearch' });

let registry: ImageProviderRegistry | null = null;
let cache: ImageSearchCache | null = null;

function getConfig(env: Record<string, string | undefined>): ImageSearchConfig {
  return {
    pinterestEnabled: env.PINTEREST_ENABLED !== 'false',
    pinterestClientId: env.PINTEREST_CLIENT_ID,
    pinterestClientSecret: env.PINTEREST_CLIENT_SECRET,
    pinterestAccessToken: env.PINTEREST_ACCESS_TOKEN,
    pinterestApiUrl: env.PINTEREST_API_URL,
    pinterestProvider: (env.PINTEREST_PROVIDER as 'internal' | 'api' | 'auto') || 'auto',
    pinterestFallbackEnabled: env.PINTEREST_FALLBACK_ENABLED !== 'false',
    pexelsApiKey: env.PEXELS_API_KEY,
    pixabayApiKey: env.PIXABAY_API_KEY,
    unsplashAccessKey: env.UNSPLASH_ACCESS_KEY,
  };
}

function createRegistry(
  env: Record<string, string | undefined>,
  kv: KVNamespace | null
): ImageProviderRegistry {
  if (registry) return registry;

  const config = getConfig(env);
  const reg = new ImageProviderRegistry(kv);

  if (config.pinterestEnabled) {
    reg.addProvider(
      new PinterestProvider({
        clientId: config.pinterestClientId,
        clientSecret: config.pinterestClientSecret,
        accessToken: config.pinterestAccessToken,
        apiUrl: config.pinterestApiUrl,
        provider: config.pinterestProvider,
        fallbackEnabled: config.pinterestFallbackEnabled,
      })
    );
  }

  if (config.pexelsApiKey) {
    reg.addProvider(new PexelsProvider(config.pexelsApiKey));
  }

  if (config.pixabayApiKey) {
    reg.addProvider(new PixabayProvider(config.pixabayApiKey));
  }

  if (config.unsplashAccessKey) {
    reg.addProvider(new UnsplashProvider(config.unsplashAccessKey));
  }

  reg.addProvider(new WikimediaProvider());

  registry = reg;
  return reg;
}

function getCache(kv: KVNamespace | null): ImageSearchCache | null {
  if (!kv) return null;
  if (cache) return cache;

  cache = new ImageSearchCache(kv);
  return cache;
}

export interface ImageSearchResponse {
  results: ImageSearchResult[];
  provider: string;
  cached: boolean;
  totalResults: number;
}

export async function searchImages(
  query: string,
  options: ImageSearchOptions = {},
  env: Record<string, string | undefined>
): Promise<ImageSearchResponse> {
  const queryCheck = validateQuery(query);
  if (!queryCheck.safe) {
    throw new Error(queryCheck.reason);
  }

  const kv = (env as any).KV as KVNamespace | undefined;
  const cacheService = getCache(kv || null);
  const page = options.page || 1;

  if (cacheService) {
    const cached = await cacheService.get(query, page);
    if (cached) {
      logger.info('Image search cache hit', { query, page });
      return {
        results: cached.results,
        provider: cached.provider,
        cached: true,
        totalResults: cached.metadata.totalResults,
      };
    }
  }

  const reg = createRegistry(env, kv || null);

  const searchOptions: ImageSearchOptions = {
    ...options,
    query,
    limit: 50,
    perPage: 50,
  };

  const startTime = Date.now();
  const { results, provider } = await reg.search(query, searchOptions);

  const sanitized = sanitizeResults(results);
  const safeResults = options.safeSearch !== false
    ? checkSafeSearch(query, sanitized)
    : sanitized;

  logger.info('Image search completed', {
    provider,
    latency: Date.now() - startTime,
    totalResults: safeResults.length,
    cached: false,
  });

  if (cacheService && safeResults.length > 0) {
    await cacheService.set(query, page, safeResults, provider, safeResults.length);
  }

  return {
    results: safeResults,
    provider,
    cached: false,
    totalResults: safeResults.length,
  };
}

export async function getProviderMetrics(
  env: Record<string, string | undefined>
) {
  const kv = (env as any).KV as KVNamespace | undefined;
  const reg = createRegistry(env, kv || null);
  return reg.getMetrics();
}

export function resetRegistry() {
  registry = null;
  cache = null;
}
