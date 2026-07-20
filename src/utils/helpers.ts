import { CONFIG } from '../../config/index.js';

// URL pattern matching for platform detection
const PLATFORM_PATTERNS: Record<string, RegExp[]> = {
  youtube: [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ],
  instagram: [
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?instagr\.am\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/,
  ],
  tiktok: [
    /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
    /(?:https?:\/\/)?(?:vm|vt)\.tiktok\.com\/[a-zA-Z0-9]+/,
  ],
  twitter: [
    /(?:https?:\/\/)?(?:www\.)?twitter\.com\/\w+\/status\/(\d+)/,
    /(?:https?:\/\/)?(?:www\.)?x\.com\/\w+\/status\/(\d+)/,
    /(?:https?:\/\/)?t\.co\/[a-zA-Z0-9]+/,
  ],
  reddit: [
    /(?:https?:\/\/)?(?:www\.)?reddit\.com\/r\/\w+\/comments\/[a-z0-9]+/,
    /(?:https?:\/\/)?(?:v\.|i\.)?redd\.it\/[a-zA-Z0-9]+\.[a-z]+/,
  ],
  facebook: [
    /(?:https?:\/\/)?(?:www\.)?facebook\.com\/.*\/videos\/\d+/,
    /(?:https?:\/\/)?(?:www\.)?facebook\.com\/watch\/\?v=\d+/,
    /(?:https?:\/\/)?fb\.watch\/[a-zA-Z0-9]+/,
  ],
  soundcloud: [
    /(?:https?:\/\/)?(?:www\.)?soundcloud\.com\/[\w.-]+\/[\w.-]+/,
  ],
  pinterest: [
    /(?:https?:\/\/)?(?:www\.)?pinterest\.com\/pin\/\d+/,
    /(?:https?:\/\/)?pin\.it\/[a-zA-Z0-9]+/,
  ],
  vimeo: [
    /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/\d+/,
    /(?:https?:\/\/)?player\.vimeo\.com\/video\/\d+/,
  ],
};

export interface PlatformInfo {
  platform: string;
  videoId?: string;
  url: string;
}

// Detect platform from URL
export function detectPlatform(url: string): PlatformInfo | null {
  for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS)) {
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          platform,
          videoId: match[1],
          url,
        };
      }
    }
  }
  return null;
}

// Validate URL
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Extract URLs from text
export function extractUrls(text: string): string[] {
  const urlPattern = /https?:\/\/[^\s]+/g;
  return text.match(urlPattern) || [];
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Format duration
export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format number with commas
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

// Truncate text
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Escape markdown special characters
export function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

// Get platform display name
export function getPlatformName(platform: string): string {
  const names: Record<string, string> = {
    youtube: 'YouTube',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    twitter: 'Twitter/X',
    reddit: 'Reddit',
    facebook: 'Facebook',
    soundcloud: 'SoundCloud',
    pinterest: 'Pinterest',
    vimeo: 'Vimeo',
  };
  return names[platform] || platform;
}
