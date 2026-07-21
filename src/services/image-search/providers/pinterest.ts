import type { ImageProvider, ImageSearchOptions, ImageSearchResult } from '../types.js';
import { getLogger } from '../../logger/index.js';

const logger = getLogger({ service: 'ImageSearch', provider: 'pinterest' });

interface PinterestConfig {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  apiUrl?: string;
  provider: 'internal' | 'api' | 'auto';
  fallbackEnabled: boolean;
}

interface PinterestPin {
  id: string;
  title?: string;
  description?: string;
  images?: {
    orig?: { url: string; width: number; height: number };
    '736x'?: { url: string; width: number; height: number };
    '474x'?: { url: string; width: number; height: number };
    '236x'?: { url: string; width: number; height: number };
  };
  link?: string;
  attribution?: {
    name?: string;
    url?: string;
  };
  board?: {
    name?: string;
  };
}

interface PinterestSearchResponse {
  resource_response?: {
    data?: Array<{
      pin?: PinterestPin;
      id?: string;
    }>;
  };
}

export class PinterestProvider implements ImageProvider {
  name = 'pinterest';
  priority = 1;
  private config: PinterestConfig;

  constructor(config: PinterestConfig) {
    this.config = config;
  }

  async search(query: string, options: ImageSearchOptions): Promise<ImageSearchResult[]> {
    const limit = options.limit || 50;

    if (this.config.provider === 'api' || (this.config.provider === 'auto' && this.config.accessToken)) {
      try {
        return await this.searchViaApi(query, limit);
      } catch (error) {
        if (this.config.provider === 'api') throw error;
        logger.warn('Pinterest API failed, falling back to internal', {
          error: (error as Error).message,
        });
      }
    }

    return this.searchViaInternal(query, limit);
  }

  private async searchViaApi(query: string, limit: number): Promise<ImageSearchResult[]> {
    if (!this.config.accessToken) {
      throw new Error('Pinterest access token not configured');
    }

    const url = new URL('https://api.pinterest.com/v5/search/pins');
    url.searchParams.set('query', query);
    url.searchParams.set('page_size', Math.min(limit, 25).toString());

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Pinterest API returned ${response.status}`);
    }

    const data = await response.json() as {
      items?: Array<{
        id: string;
        title?: string;
        description?: string;
        link?: string;
        images?: {
          '736x'?: { url: string; width: number; height: number };
          '474x'?: { url: string; width: number; height: number };
          '236x'?: { url: string; width: number; height: number };
        };
        board?: { name?: string };
        attribution?: { name?: string; url?: string };
      }>;
    };

    if (!data.items || data.items.length === 0) {
      return [];
    }

    return data.items.slice(0, limit).map((pin) => this.normalizeApiPin(pin));
  }

  private normalizeApiPin(pin: {
    id: string;
    title?: string;
    description?: string;
    link?: string;
    images?: {
      '736x'?: { url: string; width: number; height: number };
      '474x'?: { url: string; width: number; height: number };
      '236x'?: { url: string; width: number; height: number };
    };
    board?: { name?: string };
    attribution?: { name?: string; url?: string };
  }): ImageSearchResult {
    const imageUrl = pin.images?.['736x']?.url || pin.images?.['474x']?.url || pin.images?.['236x']?.url || '';
    const thumbnailUrl = pin.images?.['236x']?.url || pin.images?.['474x']?.url || imageUrl;

    return {
      id: `pinterest:${pin.id}`,
      title: pin.title || 'Untitled',
      description: pin.description,
      imageUrl: this.upgradeImageUrl(imageUrl),
      thumbnailUrl,
      sourceUrl: pin.link,
      width: pin.images?.['736x']?.width,
      height: pin.images?.['736x']?.height,
      author: pin.attribution?.name,
      authorUrl: pin.attribution?.url,
      provider: 'pinterest',
      metadata: { board: pin.board?.name },
    };
  }

  private async searchViaInternal(query: string, limit: number): Promise<ImageSearchResult[]> {
    const searchUrl = 'https://www.pinterest.com/resource/BaseSearchResource/get/';

    const dataParam = JSON.stringify({
      options: {
        query,
        scope: 'pins',
        page_size: Math.min(limit, 25),
      },
      context: {},
    });

    const params = new URLSearchParams({
      source_url: `/search/pins/?q=${encodeURIComponent(query)}`,
      data: dataParam,
    });

    const response = await fetch(`${searchUrl}?${params.toString()}`, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/javascript, */*, q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`Pinterest internal search returned ${response.status}`);
    }

    const rawData = await response.json() as PinterestSearchResponse;
    const results = rawData?.resource_response?.data;

    if (!results || results.length === 0) {
      return [];
    }

    return results.slice(0, limit).map((item) => {
      const pin = item.pin;
      if (!pin) return null;

      const imageUrl = pin.images?.orig?.url || pin.images?.['736x']?.url || pin.images?.['474x']?.url || '';
      const thumbnailUrl = pin.images?.['236x']?.url || pin.images?.['474x']?.url || imageUrl;

      return {
        id: `pinterest:${pin.id}`,
        title: pin.title || 'Untitled',
        description: pin.description,
        imageUrl: this.upgradeImageUrl(imageUrl),
        thumbnailUrl,
        sourceUrl: pin.link,
        width: pin.images?.orig?.width || pin.images?.['736x']?.width,
        height: pin.images?.orig?.height || pin.images?.['736x']?.height,
        author: pin.attribution?.name,
        authorUrl: pin.attribution?.url,
        provider: 'pinterest',
        metadata: { board: pin.board?.name },
      };
    }).filter(Boolean) as ImageSearchResult[];
  }

  private upgradeImageUrl(url: string): string {
    if (!url) return url;

    const upgraded = url
      .replace('/236x/', '/originals/')
      .replace('/474x/', '/originals/')
      .replace('/736x/', '/originals/');

    return upgraded;
  }

  async isAvailable(): Promise<boolean> {
    if (this.config.provider === 'api' && !this.config.accessToken) {
      return false;
    }

    try {
      const response = await fetch('https://www.pinterest.com', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok || response.status === 403;
    } catch {
      return false;
    }
  }
}
