import { MultiProvider, type DownloadResult } from '../providers/index.js';
import { detectPlatform, getPlatformName } from '../../utils/helpers.js';
import { getLogger } from '../logger/index.js';

const logger = getLogger({ service: 'DownloaderProvider' });

// Cobalt API Provider (Primary)
class CobaltProvider {
  name = 'cobalt';
  priority = 1;
  private apiUrl: string;
  private apiKey?: string;

  constructor() {
    this.apiUrl = process.env.COBALT_API_URL || 'https://api.cobalt.tools';
    this.apiKey = process.env.COBALT_API_KEY;
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
      const response = await fetch(`${this.apiUrl}/`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Direct Extraction Provider (Fallback)
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

    // Platform-specific extraction logic
    switch (platform.platform) {
      case 'reddit':
        return this.extractReddit(url);
      case 'twitter':
        return this.extractTwitter(url);
      case 'soundcloud':
        return this.extractSoundCloud(url);
      default:
        throw new Error(`Direct extraction not supported for ${platform.platform}`);
    }
  }

  private async extractReddit(url: string): Promise<DownloadResult> {
    // Reddit JSON API
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
    // Use fxtwitter API (public)
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

  private async extractSoundCloud(url: string): Promise<DownloadResult> {
    // SoundCloud oEmbed API
    const response = await fetch(
      `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`
    );

    if (!response.ok) {
      throw new Error('SoundCloud oEmbed returned error');
    }

    const data = await response.json() as any;

    // Extract audio URL from HTML
    const audioMatch = data.html?.match(/src="(https:\/\/[^"]*soundcloud[^"]*)"/);
    
    if (!audioMatch) {
      throw new Error('Could not extract SoundCloud audio URL');
    }

    return {
      url: audioMatch[1],
      filename: `soundcloud_${data.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'track'}`,
      mimeType: 'audio/mpeg',
      platform: 'soundcloud',
    };
  }

  async isAvailable(): Promise<boolean> {
    return true; // Always available as fallback
  }
}

// YouTube Provider (Special handling)
class YouTubeProvider {
  name = 'youtube';
  priority = 1;

  async execute(
    url: string,
    options: { format?: 'video' | 'audio'; quality?: string } = {}
  ): Promise<DownloadResult> {
    // YouTube requires special handling due to anti-bot measures
    // In production, this would use yt-dlp or similar
    throw new Error('YouTube extraction requires yt-dlp or Cobalt');
  }

  async isAvailable(): Promise<boolean> {
    // Check if yt-dlp or Cobalt is available
    return true; // Will be handled by Cobalt or yt-dlp
  }
}

// Create downloader provider chain
export function createDownloaderProviderChain(): MultiProvider<DownloadResult> {
  const provider = new MultiProvider<DownloadResult>();

  // Cobalt (primary for most platforms)
  provider.addProvider({
    name: 'cobalt',
    priority: 1,
    execute: async (url: string, options?: any) => {
      const p = new CobaltProvider();
      return p.execute(url, options);
    },
    isAvailable: async () => {
      const p = new CobaltProvider();
      return p.isAvailable();
    },
  });

  // Direct extraction (fallback)
  provider.addProvider({
    name: 'direct',
    priority: 2,
    execute: async (url: string, options?: any) => {
      const p = new DirectExtractionProvider();
      return p.execute(url, options);
    },
    isAvailable: async () => {
      const p = new DirectExtractionProvider();
      return p.isAvailable();
    },
  });

  return provider;
}

// Main download function with fallback
export async function downloadMedia(
  url: string,
  options: { format?: 'video' | 'audio'; quality?: string } = {}
): Promise<DownloadResult> {
  const provider = createDownloaderProviderChain();

  try {
    const result = await provider.execute('download', url, options);
    logger.info('Download succeeded', { 
      platform: result.platform, 
      provider: result.provider || 'unknown' 
    });
    return result.data;
  } catch (error) {
    logger.error('All download providers failed', error as Error, { url });
    throw error;
  }
}
