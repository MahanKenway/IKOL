import { MultiProvider, type DownloadResult } from '../providers/index.js';
import { detectPlatform } from '../../utils/helpers.js';
import { getLogger } from '../logger/index.js';

const logger = getLogger({ service: 'DownloaderProvider' });

// Cobalt API Provider (Primary)
class CobaltProvider {
  name = 'cobalt';
  priority = 1;
  private apiUrl: string;
  private apiKey?: string;

  constructor(env?: { COBALT_API_URL?: string; COBALT_API_KEY?: string }) {
    this.apiUrl = env?.COBALT_API_URL || 'https://api.cobalt.tools';
    this.apiKey = env?.COBALT_API_KEY;
  }

  async execute(
    url: string,
    options: { format?: 'video' | 'audio'; quality?: string } = {}
  ): Promise<DownloadResult> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.apiUrl}/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        url,
        downloadMode: options.format === 'audio' ? 'audio' : 'auto',
        videoQuality: options.quality || '1080',
        audioFormat: 'mp3',
        audioBitrate: '320',
        filenameStyle: 'pretty',
      }),
    });

    if (!response.ok) {
      throw new Error(`Cobalt returned HTTP ${response.status}`);
    }

    const data = await response.json() as any;

    if (data.status === 'error' || !data.url) {
      throw new Error(data.error?.message || 'Cobalt download failed');
    }

    const platform = detectPlatform(url);

    return {
      url: data.url,
      filename: data.filename || `download_${Date.now()}`,
      mimeType: data.mimeType || 'video/mp4',
      size: data.fileSize,
      quality: options.quality,
      platform: platform?.platform || 'unknown',
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Cobalt API is POST-only; just check if the endpoint is reachable
      const response = await fetch(this.apiUrl, {
        method: 'HEAD',
      });
      // 405 means the server is up but doesn't accept HEAD - that's fine
      return response.ok || response.status === 405;
    } catch {
      return false;
    }
  }
}

// Direct Extraction Provider (Fallback for specific platforms)
class DirectExtractionProvider {
  name = 'direct';
  priority = 2;

  async execute(
    url: string,
    options: { format?: 'video' | 'audio'; quality?: string } = {}
  ): Promise<DownloadResult> {
    const platform = detectPlatform(url);

    if (!platform) {
      throw new Error('Cannot detect platform for direct extraction');
    }

    switch (platform.platform) {
      case 'reddit':
        return this.extractReddit(url);
      case 'twitter':
        return this.extractTwitter(url);
      default:
        throw new Error(`Direct extraction not supported for ${platform.platform}`);
    }
  }

  private async extractReddit(url: string): Promise<DownloadResult> {
    const jsonUrl = url.endsWith('.json') ? url : `${url}.json`;
    const response = await fetch(jsonUrl, {
      headers: { 'User-Agent': 'IkolBot/1.0' },
    });

    if (!response.ok) {
      throw new Error('Reddit API returned error');
    }

    const data = await response.json() as any;
    const post = data[0]?.data?.children[0]?.data;

    if (!post) {
      throw new Error('Could not parse Reddit post');
    }

    const videoUrl = post.secure_media?.reddit_video?.fallback_url;
    const imageUrl = post.url;

    if (!videoUrl && !imageUrl) {
      throw new Error('No media found in Reddit post');
    }

    return {
      url: videoUrl || imageUrl,
      filename: `reddit_${post.id}`,
      mimeType: videoUrl ? 'video/mp4' : 'image/jpeg',
      platform: 'reddit',
    };
  }

  private async extractTwitter(url: string): Promise<DownloadResult> {
    const tweetId = url.match(/status\/(\d+)/)?.[1];
    if (!tweetId) {
      throw new Error('Could not extract tweet ID');
    }

    const response = await fetch(`https://api.fxtwitter.com/statuses/${tweetId}`);

    if (!response.ok) {
      throw new Error('fxtwitter API returned error');
    }

    const data = await response.json() as any;
    const media = data.tweet?.media;

    if (!media?.all?.length) {
      throw new Error('No media found in tweet');
    }

    const video = media.all.find((m: any) => m.type === 'video');
    const image = media.all.find((m: any) => m.type === 'photo');

    return {
      url: video?.url || image?.url || media.all[0].url,
      filename: `twitter_${tweetId}`,
      mimeType: video ? 'video/mp4' : 'image/jpeg',
      platform: 'twitter',
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

// Create downloader provider chain
export function createDownloaderProviderChain(env?: Record<string, string | undefined>): MultiProvider<DownloadResult> {
  const provider = new MultiProvider<DownloadResult>(null);
  const cobalt = new CobaltProvider({ COBALT_API_URL: env?.COBALT_API_URL, COBALT_API_KEY: env?.COBALT_API_KEY });
  const direct = new DirectExtractionProvider();

  provider.addProvider({
    name: 'cobalt',
    priority: 1,
    execute: (url: string, options?: any) => cobalt.execute(url, options),
    isAvailable: () => cobalt.isAvailable(),
  });

  provider.addProvider({
    name: 'direct',
    priority: 2,
    execute: (url: string, options?: any) => direct.execute(url, options),
    isAvailable: () => direct.isAvailable(),
  });

  return provider;
}

// Main download function with fallback
export async function downloadMedia(
  url: string,
  options: { format?: 'video' | 'audio'; quality?: string } = {},
  env?: Record<string, string | undefined>
): Promise<DownloadResult> {
  const provider = createDownloaderProviderChain(env);

  try {
    const result = await provider.execute('download', url, options);
    logger.info('Download succeeded', {
      platform: result.data.platform,
      provider: result.provider || 'unknown',
    });
    return result.data;
  } catch (error) {
    logger.error('All download providers failed', { url, error: (error as Error).message });
    throw error;
  }
}
