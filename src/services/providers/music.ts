import { MultiProvider, type MusicSearchResult } from '../providers/index.js';
import { getLogger } from '../logger/index.js';

const logger = getLogger({ service: 'MusicProvider' });

// Deezer Provider (Free, no auth required)
class DeezerProvider {
  name = 'deezer';
  priority = 1;

  async execute(query: string, limit: number = 5): Promise<MusicSearchResult[]> {
    const response = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Deezer returned ${response.status}`);
    }

    const data = await response.json() as any;

    return (data.data || []).map((track: any) => ({
      id: `deezer:${track.id}`,
      title: track.title,
      artist: track.artist.name,
      album: track.album.title,
      duration: track.duration,
      previewUrl: track.preview,
      coverUrl: track.album.cover_medium,
      platform: 'deezer',
    }));
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('https://api.deezer.com/search?q=test&limit=1');
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Spotify Provider (Requires API key)
class SpotifyProvider {
  name = 'spotify';
  priority = 2;
  private accessToken?: string;
  private tokenExpiry = 0;

  async execute(query: string, limit: number = 5): Promise<MusicSearchResult[]> {
    await this.ensureToken();

    if (!this.accessToken) {
      throw new Error('Spotify access token not available');
    }

    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Spotify returned ${response.status}`);
    }

    const data = await response.json() as any;
    const tracks = data.tracks?.items || [];

    return tracks.map((track: any) => ({
      id: `spotify:${track.id}`,
      title: track.name,
      artist: track.artists.map((a: any) => a.name).join(', '),
      album: track.album.name,
      duration: Math.floor(track.duration_ms / 1000),
      previewUrl: track.preview_url,
      coverUrl: track.album.images?.[0]?.url,
      platform: 'spotify',
    }));
  }

  private async ensureToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return;
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Spotify credentials not configured');
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error('Failed to get Spotify token');
    }

    const data = await response.json() as any;
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  }

  async isAvailable(): Promise<boolean> {
    return !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
  }
}

// MusicBrainz Provider (Free, no auth)
class MusicBrainzProvider {
  name = 'musicbrainz';
  priority = 3;

  async execute(query: string, limit: number = 5): Promise<MusicSearchResult[]> {
    const response = await fetch(
      `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`,
      {
        headers: {
          'User-Agent': 'IkolBot/1.0 (https://github.com/ikol-bot)',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`MusicBrainz returned ${response.status}`);
    }

    const data = await response.json() as any;

    return (data.recordings || []).map((recording: any) => ({
      id: `musicbrainz:${recording.id}`,
      title: recording.title,
      artist: recording['artist-credit']?.[0]?.name || 'Unknown',
      duration: recording.length ? Math.floor(recording.length / 1000) : 0,
      platform: 'musicbrainz',
    }));
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('https://musicbrainz.org/ws/2/recording?query=test&fmt=json&limit=1', {
        headers: { 'User-Agent': 'IkolBot/1.0' },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Last.fm Provider (Free with API key)
class LastFmProvider {
  name = 'lastfm';
  priority = 4;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.LASTFM_API_KEY || '';
  }

  async execute(query: string, limit: number = 5): Promise<MusicSearchResult[]> {
    if (!this.apiKey) {
      throw new Error('Last.fm API key not configured');
    }

    const response = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(query)}&api_key=${this.apiKey}&format=json&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Last.fm returned ${response.status}`);
    }

    const data = await response.json() as any;
    const tracks = data.results?.trackmatches?.track || [];

    return tracks.map((track: any) => ({
      id: `lastfm:${track.mbid || track.name}`,
      title: track.name,
      artist: track.artist,
      platform: 'lastfm',
    }));
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}

// Create music provider chain
export function createMusicProviderChain(): MultiProvider<MusicSearchResult[]> {
  const provider = new MultiProvider<MusicSearchResult[]>();

  provider.addProvider({
    name: 'deezer',
    priority: 1,
    execute: async (query: string, limit?: number) => {
      const p = new DeezerProvider();
      return p.execute(query, limit);
    },
    isAvailable: async () => {
      const p = new DeezerProvider();
      return p.isAvailable();
    },
  });

  provider.addProvider({
    name: 'spotify',
    priority: 2,
    execute: async (query: string, limit?: number) => {
      const p = new SpotifyProvider();
      return p.execute(query, limit);
    },
    isAvailable: async () => {
      const p = new SpotifyProvider();
      return p.isAvailable();
    },
  });

  provider.addProvider({
    name: 'musicbrainz',
    priority: 3,
    execute: async (query: string, limit?: number) => {
      const p = new MusicBrainzProvider();
      return p.execute(query, limit);
    },
    isAvailable: async () => {
      const p = new MusicBrainzProvider();
      return p.isAvailable();
    },
  });

  provider.addProvider({
    name: 'lastfm',
    priority: 4,
    execute: async (query: string, limit?: number) => {
      const p = new LastFmProvider();
      return p.execute(query, limit);
    },
    isAvailable: async () => {
      const p = new LastFmProvider();
      return p.isAvailable();
    },
  });

  return provider;
}

// Main search function with fallback
export async function searchMusic(
  query: string,
  limit: number = 5
): Promise<{ results: MusicSearchResult[]; source: string }> {
  const provider = createMusicProviderChain();

  try {
    const result = await provider.execute('search', query, limit);
    return { results: result.data, source: result.provider };
  } catch (error) {
    logger.error('All music providers failed', error as Error, { query });
    throw error;
  }
}
