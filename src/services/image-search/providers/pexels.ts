import type { ImageProvider, ImageSearchOptions, ImageSearchResult } from '../types.js';
import { getLogger } from '../../logger/index.js';

const logger = getLogger({ service: 'ImageSearch', provider: 'pexels' });

interface PexelsPhoto {
  id: number;
  alt_description?: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  width: number;
  height: number;
  user: {
    name: string;
    url: string;
  };
  links: {
    html: string;
  };
}

interface PexelsResponse {
  photos: PexelsPhoto[];
  total_results: number;
  page: number;
  per_page: number;
}

export class PexelsProvider implements ImageProvider {
  name = 'pexels';
  priority = 2;
  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, options: ImageSearchOptions): Promise<ImageSearchResult[]> {
    if (!this.apiKey) {
      throw new Error('Pexels API key not configured');
    }

    const page = options.page || 1;
    const perPage = options.perPage || 15;
    const limit = options.limit || 50;

    const url = new URL('https://api.pexels.com/v1/search');
    url.searchParams.set('query', query);
    url.searchParams.set('page', page.toString());
    url.searchParams.set('per_page', Math.min(perPage, 80).toString());

    if (options.orientation) {
      url.searchParams.set('orientation', options.orientation);
    }

    if (options.size) {
      url.searchParams.set('size', options.size);
    }

    if (options.color) {
      url.searchParams.set('color', options.color);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Pexels API returned ${response.status}`);
    }

    const data: PexelsResponse = await response.json() as PexelsResponse;

    if (!data.photos || data.photos.length === 0) {
      return [];
    }

    return data.photos.slice(0, limit).map((photo) => ({
      id: `pexels:${photo.id}`,
      title: photo.alt_description || 'Untitled',
      description: photo.alt_description,
      imageUrl: photo.urls.raw,
      thumbnailUrl: photo.urls.small,
      sourceUrl: photo.links.html,
      width: photo.width,
      height: photo.height,
      author: photo.user.name,
      authorUrl: photo.user.url,
      provider: 'pexels',
    }));
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}
