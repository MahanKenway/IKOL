import { MultiProvider, type LyricsResult } from '../providers/index.js';
import { getLogger } from '../logger/index.js';

const logger = getLogger({ service: 'LyricsProvider' });

// LRCLIB Provider (Free, open-source)
class LRCLIBProvider {
  name = 'lrclib';
  priority = 1;

  async execute(artist: string, title: string): Promise<LyricsResult> {
    if (!artist || !title) {
      throw new Error('Artist and title are required');
    }

    const response = await fetch(
      `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`
    );

    if (!response.ok) {
      throw new Error(`LRCLIB returned ${response.status}`);
    }

    const data = await response.json() as any;

    return {
      plainLyrics: data.plainLyrics || undefined,
      syncedLyrics: data.syncedLyrics || undefined,
      source: 'lrclib',
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('https://lrclib.net/api/health');
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Genius Provider (Free for non-commercial)
class GeniusProvider {
  name = 'genius';
  priority = 2;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || '';
  }

  async execute(artist: string, title: string): Promise<LyricsResult> {
    if (!this.apiKey) {
      throw new Error('Genius API key not configured');
    }

    // Search for the song
    const searchResponse = await fetch(
      `https://api.genius.com/search?q=${encodeURIComponent(`${artist} ${title}`)}`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      }
    );

    if (!searchResponse.ok) {
      throw new Error(`Genius search returned ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json() as any;
    const hits = searchData.response?.hits || [];

    if (hits.length === 0) {
      throw new Error('No results found on Genius');
    }

    // Get the first result's lyrics page
    const song = hits[0].result;
    const lyricsUrl = song.url;

    const lyricsResponse = await fetch(lyricsUrl);
    if (!lyricsResponse.ok) {
      throw new Error(`Genius lyrics page returned ${lyricsResponse.status}`);
    }
    const html = await lyricsResponse.text();

    // Extract lyrics from HTML
    const lyricsMatch = html.match(/<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/);

    if (!lyricsMatch) {
      throw new Error('Could not extract lyrics from Genius');
    }

    // Clean HTML tags
    const plainLyrics = lyricsMatch[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();

    return {
      plainLyrics,
      source: 'genius',
    };
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}

// Musixmatch Provider (Limited free tier)
class MusixmatchProvider {
  name = 'musixmatch';
  priority = 3;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || '';
  }

  async execute(artist: string, title: string): Promise<LyricsResult> {
    if (!this.apiKey) {
      throw new Error('Musixmatch API key not configured');
    }

    // Search for the track
    const searchResponse = await fetch(
      `https://api.musixmatch.com/ws/1.1/track.search?q=${encodeURIComponent(`${artist} ${title}`)}&apikey=${this.apiKey}`
    );

    if (!searchResponse.ok) {
      throw new Error(`Musixmatch search returned ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json() as any;
    const tracks = searchData.message?.body?.track_list || [];

    if (tracks.length === 0) {
      throw new Error('No results found on Musixmatch');
    }

    const trackId = tracks[0].track.track_id;

    // Get lyrics
    const lyricsResponse = await fetch(
      `https://api.musixmatch.com/ws/1.1/track.lyrics.get?track_id=${trackId}&apikey=${this.apiKey}`
    );

    if (!lyricsResponse.ok) {
      throw new Error(`Musixmatch lyrics returned ${lyricsResponse.status}`);
    }

    const lyricsData = await lyricsResponse.json() as any;
    const lyrics = lyricsData.message?.body?.lyrics?.lyrics_body;

    if (!lyrics) {
      throw new Error('No lyrics available');
    }

    return {
      plainLyrics: lyrics,
      source: 'musixmatch',
    };
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}

// Create lyrics provider chain
export function createLyricsProviderChain(env?: Record<string, string | undefined>): MultiProvider<LyricsResult> {
  const provider = new MultiProvider<LyricsResult>(null);
  const lrclib = new LRCLIBProvider();
  const genius = new GeniusProvider(env?.GENIUS_API_KEY);
  const musixmatch = new MusixmatchProvider(env?.MUSIXMATCH_API_KEY);

  provider.addProvider({
    name: 'lrclib',
    priority: 1,
    execute: (artist: string, title: string) => lrclib.execute(artist, title),
    isAvailable: () => lrclib.isAvailable(),
  });

  provider.addProvider({
    name: 'genius',
    priority: 2,
    execute: (artist: string, title: string) => genius.execute(artist, title),
    isAvailable: () => genius.isAvailable(),
  });

  provider.addProvider({
    name: 'musixmatch',
    priority: 3,
    execute: (artist: string, title: string) => musixmatch.execute(artist, title),
    isAvailable: () => musixmatch.isAvailable(),
  });

  return provider;
}

// Get lyrics with fallback
export async function getLyrics(
  artist: string,
  title: string,
  env?: Record<string, string | undefined>
): Promise<LyricsResult | null> {
  const provider = createLyricsProviderChain(env);

  try {
    const result = await provider.execute('lyrics:search', artist, title);
    return result.data;
  } catch (error) {
    logger.error('All lyrics providers failed', { artist, title, error: (error as Error).message });
    return null;
  }
}
