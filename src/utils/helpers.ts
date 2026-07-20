// Helpers - Cloudflare Workers compatible

export function detectPlatform(url: string): { platform: string; videoId?: string; url: string } | null {
  const patterns: Record<string, RegExp[]> = {
    youtube: [/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/, /youtu\.be\/([a-zA-Z0-9_-]+)/],
    tiktok: [/tiktok\.com\/@[\w.-]+\/video\/(\d+)/],
    twitter: [/twitter\.com\/\w+\/status\/(\d+)/, /x\.com\/\w+\/status\/(\d+)/],
    instagram: [/instagram\.com\/(?:p|reel)\/([a-zA-Z0-9_-]+)/],
  };
  for (const [platform, regexes] of Object.entries(patterns)) {
    for (const regex of regexes) {
      const match = url.match(regex);
      if (match) return { platform, videoId: match[1], url };
    }
  }
  return null;
}

export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return hrs > 0
    ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    : `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function truncate(text: string, max: number): string {
  return text.length > max ? text.substring(0, max - 3) + '...' : text;
}
