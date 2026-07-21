import { MultiProvider, type MusicSearchResult, type QualityOption } from '../providers/index.js';

// Deezer (Free, no auth)
class DeezerProvider {
  name = 'deezer';
  async execute(query: string, limit: number = 5): Promise<MusicSearchResult[]> {
    const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    if (!res.ok) throw new Error(`Deezer ${res.status}`);
    const data = await res.json() as any;
    return (data.data || []).map((t: any) => ({
      id: `deezer:${t.id}`, title: t.title, artist: t.artist.name,
      album: t.album.title, duration: t.duration, previewUrl: t.preview,
      coverUrl: t.album.cover_medium, platform: 'deezer',
      artistId: `deezer:${t.artist.id}`,
      albumId: `deezer:${t.album.id}`,
      sourceUrl: t.link,
      qualities: [
        { format: 'mp3', bitrate: 128, label: 'MP3 128kbps', available: true },
        { format: 'mp3', bitrate: 256, label: 'MP3 256kbps', available: true },
        { format: 'mp3', bitrate: 320, label: 'MP3 320kbps', available: true },
        { format: 'flac', bitrate: 0, label: 'FLAC Lossless', available: true },
      ],
    }));
  }
  async isAvailable() { return true; }
}

// Spotify (Requires keys, token cached)
class SpotifyProvider {
  name = 'spotify';
  private token?: string;
  private expiry = 0;
  constructor(private clientId?: string, private clientSecret?: string) {}

  async execute(query: string, limit: number = 5): Promise<MusicSearchResult[]> {
    await this.ensureToken();
    if (!this.token) throw new Error('Spotify not configured');
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
      { headers: { Authorization: `Bearer ${this.token}` } }
    );
    if (!res.ok) throw new Error(`Spotify ${res.status}`);
    const data = await res.json() as any;
    return (data.tracks?.items || []).map((t: any) => ({
      id: `spotify:${t.id}`, title: t.name,
      artist: t.artists.map((a: any) => a.name).join(', '),
      album: t.album.name, duration: Math.floor(t.duration_ms / 1000),
      previewUrl: t.preview_url, coverUrl: t.album.images?.[0]?.url, platform: 'spotify',
      artistId: t.artists?.[0]?.id ? `spotify:${t.artists[0].id}` : undefined,
      albumId: t.album?.id ? `spotify:${t.album.id}` : undefined,
      sourceUrl: t.external_urls?.spotify,
      explicit: t.explicit,
      releaseDate: t.album?.release_date,
      qualities: [
        { format: 'mp3', bitrate: 128, label: 'MP3 128kbps', available: true },
        { format: 'mp3', bitrate: 256, label: 'MP3 256kbps', available: true },
      ],
    }));
  }

  private async ensureToken() {
    if (this.token && Date.now() < this.expiry) return;
    if (!this.clientId || !this.clientSecret) throw new Error('Spotify credentials not set');
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}` },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) throw new Error('Spotify token failed');
    const data = await res.json() as any;
    this.token = data.access_token;
    this.expiry = Date.now() + (data.expires_in - 60) * 1000;
  }

  isAvailable() { return Promise.resolve(!!(this.clientId && this.clientSecret)); }
}

// Last.fm (Free with API key, enriches metadata)
class LastFmProvider {
  name = 'lastfm';
  private apiKey?: string;
  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async execute(query: string, limit: number = 5): Promise<MusicSearchResult[]> {
    if (!this.apiKey) throw new Error('Last.fm API key not configured');
    const res = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(query)}&limit=${limit}&api_key=${this.apiKey}&format=json`
    );
    if (!res.ok) throw new Error(`Last.fm ${res.status}`);
    const data = await res.json() as any;
    return (data.results?.trackmatches?.track || []).map((t: any) => ({
      id: `lastfm:${t.mbid || t.name}`, title: t.name, artist: t.artist,
      album: '', duration: 0, platform: 'lastfm',
      sourceUrl: t.url,
      qualities: [
        { format: 'mp3', bitrate: 128, label: 'MP3 128kbps', available: true },
      ],
    }));
  }

  async isAvailable() { return Promise.resolve(!!this.apiKey); }

  // Enrich a track with detailed metadata from Last.fm
  async getTrackInfo(artist: string, title: string): Promise<Partial<MusicSearchResult> | null> {
    if (!this.apiKey) return null;
    try {
      const res = await fetch(
        `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&api_key=${this.apiKey}&format=json`
      );
      if (!res.ok) return null;
      const data = await res.json() as any;
      const track = data.track;
      if (!track) return null;

      return {
        album: track.album?.title,
        duration: track.duration ? Math.floor(parseInt(track.duration) / 1000) : 0,
        coverUrl: track.album?.image?.find((img: any) => img.size === 'extralarge')?.['#text'],
        sourceUrl: track.url,
        genre: track.toptags?.tag?.[0]?.name,
        explicit: false,
      };
    } catch {
      return null;
    }
  }
}

// MusicBrainz (Free, no auth)
class MusicBrainzProvider {
  name = 'musicbrainz';
  async execute(query: string, limit: number = 5): Promise<MusicSearchResult[]> {
    const res = await fetch(
      `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`,
      { headers: { 'User-Agent': 'IkolBot/2.0' } }
    );
    if (!res.ok) throw new Error(`MusicBrainz ${res.status}`);
    const data = await res.json() as any;
    return (data.recordings || []).map((r: any) => ({
      id: `musicbrainz:${r.id}`, title: r.title,
      artist: r['artist-credit']?.[0]?.name || 'Unknown',
      duration: r.length ? Math.floor(r.length / 1000) : 0, platform: 'musicbrainz',
      qualities: [
        { format: 'mp3', bitrate: 128, label: 'MP3 128kbps', available: true },
      ],
    }));
  }
  isAvailable() { return Promise.resolve(true); }
}

// iTunes Search (Free, no auth)
class ITunesProvider {
  name = 'itunes';
  async execute(query: string, limit: number = 5): Promise<MusicSearchResult[]> {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=${limit}`
    );
    if (!res.ok) throw new Error(`iTunes ${res.status}`);
    const data = await res.json() as any;
    return (data.results || []).map((t: any) => ({
      id: `itunes:${t.trackId}`, title: t.trackName,
      artist: t.artistName, album: t.collectionName,
      duration: Math.floor(t.trackTimeMillis / 1000),
      previewUrl: t.previewUrl, coverUrl: t.artworkUrl100,
      platform: 'itunes',
      artistId: `itunes:${t.artistId}`,
      albumId: `itunes:${t.collectionId}`,
      sourceUrl: t.trackViewUrl,
      releaseDate: t.releaseDate,
      qualities: [
        { format: 'mp3', bitrate: 256, label: 'AAC 256kbps', available: true },
      ],
    }));
  }
  isAvailable() { return Promise.resolve(true); }
}

// Singleton instances (preserve state across calls)
let _chain: MultiProvider<MusicSearchResult[]> | null = null;
let _chainEnv: string | undefined;
let _lastfm: LastFmProvider | null = null;

export function createMusicProviderChain(env?: Record<string, string | undefined>): MultiProvider<MusicSearchResult[]> {
  const envKey = JSON.stringify(env || {});
  if (_chain && _chainEnv === envKey) return _chain;

  _chain = new MultiProvider<MusicSearchResult[]>(null);
  _chainEnv = envKey;

  const deezer = new DeezerProvider();
  const spotify = new SpotifyProvider(env?.SPOTIFY_CLIENT_ID, env?.SPOTIFY_CLIENT_SECRET);
  const lastfm = new LastFmProvider(env?.LASTFM_API_KEY);
  const musicbrainz = new MusicBrainzProvider();
  const itunes = new ITunesProvider();

  _lastfm = lastfm;

  _chain.addProvider({ name: 'deezer', priority: 1, execute: (query: string, limit?: number) => deezer.execute(query, limit), isAvailable: () => deezer.isAvailable() });
  _chain.addProvider({ name: 'spotify', priority: 2, execute: (query: string, limit?: number) => spotify.execute(query, limit), isAvailable: () => spotify.isAvailable() });
  _chain.addProvider({ name: 'itunes', priority: 3, execute: (query: string, limit?: number) => itunes.execute(query, limit), isAvailable: () => itunes.isAvailable() });
  _chain.addProvider({ name: 'lastfm', priority: 4, execute: (query: string, limit?: number) => lastfm.execute(query, limit), isAvailable: () => lastfm.isAvailable() });
  _chain.addProvider({ name: 'musicbrainz', priority: 5, execute: (query: string, limit?: number) => musicbrainz.execute(query, limit), isAvailable: () => musicbrainz.isAvailable() });

  return _chain;
}

export async function searchMusic(
  query: string, limit: number = 5, env?: Record<string, string | undefined>
): Promise<{ results: MusicSearchResult[]; source: string }> {
  const chain = createMusicProviderChain(env);
  const result = await chain.execute('music:search', query, limit);
  return { results: result.data, source: result.provider };
}

// Enrich track metadata from Last.fm
export async function enrichTrackMetadata(
  track: MusicSearchResult, env?: Record<string, string | undefined>
): Promise<MusicSearchResult> {
  if (!env?.LASTFM_API_KEY) return track;

  const lastfm = new LastFmProvider(env.LASTFM_API_KEY);
  const enrichment = await lastfm.getTrackInfo(track.artist, track.title);

  if (enrichment) {
    return {
      ...track,
      album: track.album || enrichment.album,
      duration: track.duration || enrichment.duration || 0,
      coverUrl: track.coverUrl || enrichment.coverUrl,
      sourceUrl: track.sourceUrl || enrichment.sourceUrl,
      genre: track.genre || enrichment.genre,
    };
  }

  return track;
}

export function resetProviderChain() {
  _chain = null;
  _chainEnv = undefined;
  _lastfm = null;
}
