import type { ImageProvider, ImageSearchOptions, ImageSearchResult } from '../types.js';
import { getLogger } from '../../logger/index.js';

const logger = getLogger({ service: 'ImageSearch', provider: 'wikimedia' });

interface WikimediaSearchResult {
  title: string;
  pageid: number;
}

interface WikimediaImageInfo {
  pageid: number;
  title: string;
  imageinfo?: Array<{
    url: string;
    thumburl: string;
    width: number;
    height: number;
    extmetadata?: {
      ImageDescription?: { value: string };
      Artist?: { value: string };
    };
  }>;
}

interface WikimediaSearchResponse {
  query?: {
    searchinfo?: { totalhits: number };
    search: WikimediaSearchResult[];
  };
}

interface WikimediaImageResponse {
  query?: {
    pages: Record<string, WikimediaImageInfo>;
  };
}

export class WikimediaProvider implements ImageProvider {
  name = 'wikimedia';
  priority = 5;

  async search(query: string, options: ImageSearchOptions): Promise<ImageSearchResult[]> {
    const limit = options.limit || 50;
    const perPage = Math.min(limit, 50);

    const searchUrl = new URL('https://commons.wikimedia.org/w/api.php');
    searchUrl.searchParams.set('action', 'query');
    searchUrl.searchParams.set('list', 'search');
    searchUrl.searchParams.set('srsearch', query);
    searchUrl.searchParams.set('srnamespace', '6');
    searchUrl.searchParams.set('srlimit', perPage.toString());
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('origin', '*');

    const searchResponse = await fetch(searchUrl.toString(), {
      headers: {
        'User-Agent': 'IkolBot/2.0 (Image Search; https://github.com/ikol-bot)',
      },
    });

    if (!searchResponse.ok) {
      throw new Error(`Wikimedia search returned ${searchResponse.status}`);
    }

    const searchData: WikimediaSearchResponse = await searchResponse.json() as WikimediaSearchResponse;
    const searchResults = searchData?.query?.search;

    if (!searchResults || searchResults.length === 0) {
      return [];
    }

    const titles = searchResults.map((r) => r.title).join('|');

    const infoUrl = new URL('https://commons.wikimedia.org/w/api.php');
    infoUrl.searchParams.set('action', 'query');
    infoUrl.searchParams.set('titles', titles);
    infoUrl.searchParams.set('prop', 'imageinfo');
    infoUrl.searchParams.set('iiprop', 'url|extmetadata|size');
    infoUrl.searchParams.set('iiurlwidth', '800');
    infoUrl.searchParams.set('format', 'json');
    infoUrl.searchParams.set('origin', '*');

    const infoResponse = await fetch(infoUrl.toString(), {
      headers: {
        'User-Agent': 'IkolBot/2.0 (Image Search; https://github.com/ikol-bot)',
      },
    });

    if (!infoResponse.ok) {
      throw new Error(`Wikimedia image info returned ${infoResponse.status}`);
    }

    const infoData: WikimediaImageResponse = await infoResponse.json() as WikimediaImageResponse;
    const pages = infoData?.query?.pages || {};

    const results: ImageSearchResult[] = [];

    for (const page of Object.values(pages)) {
      if (!page.imageinfo || page.imageinfo.length === 0) continue;

      const info = page.imageinfo[0];
      if (!info.url) continue;

      const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(info.url);
      if (!isImage) continue;

      const description = info.extmetadata?.ImageDescription?.value || '';
      const cleanDescription = description.replace(/<[^>]*>/g, '').slice(0, 200);

      results.push({
        id: `wikimedia:${page.pageid}`,
        title: page.title.replace(/^File:/, ''),
        description: cleanDescription || undefined,
        imageUrl: info.thumburl || info.url,
        thumbnailUrl: info.thumburl || info.url,
        sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
        width: info.width,
        height: info.height,
        author: info.extmetadata?.Artist?.value?.replace(/<[^>]*>/g, ''),
        provider: 'wikimedia',
      });

      if (results.length >= limit) break;
    }

    return results;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
