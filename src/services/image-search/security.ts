import type { ImageSearchResult } from './types.js';
import { getLogger } from '../logger/index.js';

const logger = getLogger({ service: 'ImageSearch' });

const ALLOWED_DOMAINS = [
  'i.pinimg.com',
  'images.pexels.com',
  'pixabay.com',
  'images.unsplash.com',
  'upload.wikimedia.org',
  'commons.wikimedia.org',
  'cdn.pixabay.com',
  'images.unsplash.com',
];

const BLOCKED_PATTERNS = [
  /malware/i,
  /phishing/i,
  /\.exe$/i,
  /\.bat$/i,
  /\.cmd$/i,
  /\.scr$/i,
  /\.com$/i,
  /\.pif$/i,
  /javascript:/i,
  /data:text\/html/i,
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const SAFE_SEARCH_KEYWORDS = [
  'nsfw',
  'nude',
  'naked',
  'porn',
  'xxx',
  'adult',
  'explicit',
];

export interface SecurityCheckResult {
  safe: boolean;
  reason?: string;
}

export function validateImageUrl(url: string): SecurityCheckResult {
  if (!url) {
    return { safe: false, reason: 'Empty URL' };
  }

  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, '');

    const isAllowed = ALLOWED_DOMAINS.some((d) =>
      domain === d || domain.endsWith(`.${d}`)
    );

    if (!isAllowed) {
      return { safe: false, reason: `Domain not allowed: ${domain}` };
    }

    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(url)) {
        return { safe: false, reason: 'URL matches blocked pattern' };
      }
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }
}

export function validateQuery(query: string): SecurityCheckResult {
  if (!query || query.trim().length === 0) {
    return { safe: false, reason: 'Empty query' };
  }

  if (query.length > 500) {
    return { safe: false, reason: 'Query too long' };
  }

  return { safe: true };
}

export function checkSafeSearch(query: string, results: ImageSearchResult[]): ImageSearchResult[] {
  const queryLower = query.toLowerCase();
  const hasExplicitQuery = SAFE_SEARCH_KEYWORDS.some((k) => queryLower.includes(k));

  if (hasExplicitQuery) {
    return [];
  }

  return results.filter((r) => {
    const text = `${r.title} ${r.description || ''}`.toLowerCase();
    return !SAFE_SEARCH_KEYWORDS.some((k) => text.includes(k));
  });
}

export async function checkFileSize(url: string): Promise<SecurityCheckResult> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { safe: false, reason: `HEAD request failed: ${response.status}` };
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
      return { safe: false, reason: 'File too large' };
    }

    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.startsWith('image/')) {
      return { safe: false, reason: 'Not an image' };
    }

    return { safe: true };
  } catch (error) {
    logger.warn('File size check failed', {
      url,
      error: (error as Error).message,
    });
    return { safe: true };
  }
}

export function sanitizeResults(results: ImageSearchResult[]): ImageSearchResult[] {
  return results
    .map((r) => ({
      ...r,
      title: r.title.replace(/[<>]/g, ''),
      description: r.description?.replace(/[<>]/g, ''),
    }))
    .filter((r) => {
      const urlCheck = validateImageUrl(r.imageUrl);
      return urlCheck.safe;
    });
}
