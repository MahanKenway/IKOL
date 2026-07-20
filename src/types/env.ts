// Cloudflare Environment Bindings
export interface Env {
  // D1 Database
  DB: D1Database;
  
  // KV Storage
  KV: KVNamespace;
  
  // R2 Storage
  R2: R2Bucket;
  
  // Environment variables
  ENVIRONMENT: string;
  
  // Bot Configuration
  BOT_TOKEN: string;
  BOT_WEBHOOK_SECRET: string;
  
  // AI Provider Keys
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  
  // External API Keys
  NASA_API_KEY?: string;
  STEAM_API_KEY?: string;
  LASTFM_API_KEY?: string;
  
  // Feature Flags
  ENABLE_AI?: string;
  ENABLE_DOWNLOADER?: string;
  ENABLE_MUSIC?: string;
}

// Bot Context Extension
export interface BotContext {
  db: D1Database;
  kv: KVNamespace;
  r2: R2Bucket;
  userId: number;
  username?: string;
  firstName: string;
  language: string;
  isAdmin: boolean;
}

// Module Configuration
export interface ModuleConfig {
  enabled: boolean;
  cooldown?: number;
  rateLimit?: number;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  cached?: boolean;
}

// Download Types
export interface DownloadRequest {
  url: string;
  format?: 'video' | 'audio';
  quality?: 'best' | 'high' | 'medium' | 'low';
}

export interface DownloadResult {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  thumbnail?: string;
  title?: string;
  duration?: number;
}

// Music Types
export interface TrackInfo {
  id: number;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  previewUrl?: string;
  coverUrl?: string;
  releaseDate?: string;
}

export interface ArtistInfo {
  id: number;
  name: string;
  pictureUrl?: string;
  nbAlbums: number;
  nbFans: number;
  bio?: string;
}

export interface AlbumInfo {
  id: number;
  title: string;
  artist: string;
  coverUrl?: string;
  releaseDate?: string;
  tracks: TrackInfo[];
}

// Finance Types
export interface CurrencyRate {
  from: string;
  to: string;
  rate: number;
  timestamp: number;
}

export interface GoldPrice {
  type: string;
  price: number;
  currency: string;
  change: number;
  changePercent: number;
}

// Space Types
export interface ApodData {
  date: string;
  title: string;
  explanation: string;
  url: string;
  hdurl?: string;
  mediaType: 'image' | 'video';
  thumbnailUrl?: string;
}

export interface LaunchData {
  id: string;
  name: string;
  date: string;
  status: string;
  rocket: string;
  details?: string;
  webcast?: string;
  imageUrl?: string;
}

// Gaming Types
export interface FreeGame {
  id: string;
  title: string;
  description: string;
  publisher: string;
  imageUrl?: string;
  storeUrl: string;
  startDate: string;
  endDate: string;
}

// User Types
export interface User {
  id: number;
  username?: string;
  firstName: string;
  lastName?: string;
  language: string;
  createdAt: string;
  lastActive: string;
  settings: UserSettings;
}

export interface UserSettings {
  aiProvider: string;
  aiModel: string;
  language: string;
  notifications: boolean;
  theme: 'light' | 'dark' | 'auto';
}

// Database Migration
export interface Migration {
  id: number;
  name: string;
  appliedAt: string;
}
