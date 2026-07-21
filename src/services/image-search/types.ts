export interface ImageSearchResult {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  thumbnailUrl: string;
  sourceUrl?: string;
  width?: number;
  height?: number;
  author?: string;
  authorUrl?: string;
  provider: string;
  metadata?: Record<string, unknown>;
}

export interface ImageSearchOptions {
  query?: string;
  page?: number;
  perPage?: number;
  limit?: number;
  safeSearch?: boolean;
  orientation?: 'landscape' | 'portrait' | 'square';
  size?: 'small' | 'medium' | 'large';
  color?: string;
  category?: string;
}

export interface ImageProvider {
  name: string;
  priority: number;
  search(query: string, options: ImageSearchOptions): Promise<ImageSearchResult[]>;
  isAvailable(): Promise<boolean>;
}

export interface ImageSearchCacheEntry {
  results: ImageSearchResult[];
  provider: string;
  timestamp: number;
  metadata: {
    totalResults: number;
    query: string;
    page: number;
  };
}

export interface ImageSearchConfig {
  pinterestEnabled: boolean;
  pinterestClientId?: string;
  pinterestClientSecret?: string;
  pinterestAccessToken?: string;
  pinterestApiUrl?: string;
  pinterestProvider: 'internal' | 'api' | 'auto';
  pinterestFallbackEnabled: boolean;
  pexelsApiKey?: string;
  pixabayApiKey?: string;
  unsplashAccessKey?: string;
}
