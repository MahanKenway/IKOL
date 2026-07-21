import type { ImageProvider, ImageSearchOptions, ImageSearchResult } from '../types.js';
import { getLogger } from '../../logger/index.js';

const logger = getLogger({ service: 'ImageSearch', provider: 'unsplash' });

interface UnsplashPhoto {
  id: string;
  description?: string;
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
    links: {
      html: string;
    };
  };
  links: {
    html: string;
  };
}

interface UnsplashResponse {
  results: UnsplashPhoto[];
  total: number;
  total_pages: number;
}

export class UnsplashProvider implements ImageProvider {
  name = 'unsplash';
  priority = 4;
  private accessKey: string | undefined;

  constructor(accessKey?: string) {
    this.accessKey = accessKey;
  }

  async search(query: string, options: ImageSearchOptions): Promise<ImageSearchResult[]> {
    if (!this.accessKey) {
      throw new Error('Unsplash access key not configured');
    }

    const page = options.page || 1;
    const perPage = options.perPage || 10;
    const limit = options.limit || 50;

    const url = new URL('https://api.unsplash.com/search/photos');
    url.searchParams.set('query', query);
    url.searchParams.set('page', page.toString());
    url.searchParams.set('per_page', Math.min(perPage, 30).toString());

    if (options.orientation) {
      url.searchParams.set('orientation', options.orientation);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Client-ID ${this.accessKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Unsplash API returned ${response.status}`);
    }

    const data: UnsplashResponse = await response.json() as UnsplashResponse;

    if (!data.results || data.results.length === 0) {
      return [];
    }

    return data.results.slice(0, limit).map((photo) => ({
      id: `unsplash:${photo.id}`,
      title: photo.alt_description || photo.description || 'Untitled',
      description: photo.description || photo.alt_description,
      imageUrl: photo.urls.regular,
      thumbnailUrl: photo.urls.small,
      sourceUrl: photo.links.html,
      width: photo.width,
      height: photo.height,
      author: photo.user.name,
      authorUrl: photo.user.links.html,
      provider: 'unsplash',
    }));
  }

  async isAvailable(): Promise<boolean> {
    return !!this.accessKey;
  }
}
