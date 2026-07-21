import type { ImageProvider, ImageSearchOptions, ImageSearchResult } from '../types.js';
import { getLogger } from '../../logger/index.js';

const logger = getLogger({ service: 'ImageSearch', provider: 'pixabay' });

interface PixabayHit {
  id: number;
  pageURL: string;
  type: string;
  tags: string;
  previewURL: string;
  previewWidth: number;
  previewHeight: number;
  webformatURL: string;
  webformatWidth: number;
  webformatHeight: number;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  imageSize: number;
  user: string;
  userImageURL: string;
}

interface PixabayResponse {
  total: number;
  totalHits: number;
  hits: PixabayHit[];
}

export class PixabayProvider implements ImageProvider {
  name = 'pixabay';
  priority = 3;
  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, options: ImageSearchOptions): Promise<ImageSearchResult[]> {
    if (!this.apiKey) {
      throw new Error('Pixabay API key not configured');
    }

    const page = options.page || 1;
    const perPage = options.perPage || 20;
    const limit = options.limit || 50;

    const url = new URL('https://pixabay.com/api/');
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('q', query);
    url.searchParams.set('page', page.toString());
    url.searchParams.set('per_page', Math.min(perPage, 200).toString());
    url.searchParams.set('safesearch', options.safeSearch !== false ? 'true' : 'false');

    if (options.orientation) {
      const orientationMap = {
        landscape: 'horizontal',
        portrait: 'vertical',
        square: 'horizontal',
      };
      url.searchParams.set('orientation', orientationMap[options.orientation]);
    }

    if (options.category) {
      url.searchParams.set('category', options.category);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Pixabay API returned ${response.status}`);
    }

    const data: PixabayResponse = await response.json() as PixabayResponse;

    if (!data.hits || data.hits.length === 0) {
      return [];
    }

    return data.hits.slice(0, limit).map((hit) => ({
      id: `pixabay:${hit.id}`,
      title: hit.tags.split(',')[0]?.trim() || 'Untitled',
      description: hit.tags,
      imageUrl: hit.largeImageURL || hit.webformatURL,
      thumbnailUrl: hit.previewURL,
      sourceUrl: hit.pageURL,
      width: hit.imageWidth,
      height: hit.imageHeight,
      author: hit.user,
      provider: 'pixabay',
      metadata: { type: hit.type, tags: hit.tags },
    }));
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}
