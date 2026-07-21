import { describe, it, expect } from 'vitest';
import { detectPlatform, isValidUrl, extractUrls, formatFileSize, formatDuration } from '../src/utils/helpers.js';

describe('URL Utilities', () => {
  describe('detectPlatform', () => {
    it('should detect YouTube URLs', () => {
      expect(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.platform).toBe('youtube');
      expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')?.platform).toBe('youtube');
      expect(detectPlatform('https://youtube.com/shorts/abc123')?.platform).toBe('youtube');
    });

    it('should detect Instagram URLs', () => {
      expect(detectPlatform('https://www.instagram.com/p/ABC123/')?.platform).toBe('instagram');
      expect(detectPlatform('https://instagram.com/reel/XYZ789/')?.platform).toBe('instagram');
    });

    it('should detect TikTok URLs', () => {
      expect(detectPlatform('https://www.tiktok.com/@user/video/123456')?.platform).toBe('tiktok');
      expect(detectPlatform('https://vm.tiktok.com/abc123/')?.platform).toBe('tiktok');
    });

    it('should detect Twitter/X URLs', () => {
      expect(detectPlatform('https://twitter.com/user/status/123456')?.platform).toBe('twitter');
      expect(detectPlatform('https://x.com/user/status/123456')?.platform).toBe('twitter');
    });

    it('should detect Reddit URLs', () => {
      expect(detectPlatform('https://reddit.com/r/subreddit/comments/abc123/')?.platform).toBe('reddit');
      expect(detectPlatform('https://v.redd.it/abc123')?.platform).toBe('reddit');
    });

    it('should return null for unknown URLs', () => {
      expect(detectPlatform('https://example.com')).toBeNull();
      expect(detectPlatform('not a url')).toBeNull();
    });
  });

  describe('isValidUrl', () => {
    it('should validate URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://example.com/path?q=1')).toBe(true);
      expect(isValidUrl('not a url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('extractUrls', () => {
    it('should extract URLs from text', () => {
      const text = 'Check out https://example.com and http://test.org/path';
      const urls = extractUrls(text);
      expect(urls).toHaveLength(2);
      expect(urls[0]).toBe('https://example.com');
    });

    it('should return empty array if no URLs', () => {
      expect(extractUrls('no urls here')).toHaveLength(0);
    });
  });
});

describe('Formatting Utilities', () => {
  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds correctly', () => {
      expect(formatDuration(0)).toBe('0:00');
      expect(formatDuration(65)).toBe('1:05');
      expect(formatDuration(3661)).toBe('1:01:01');
    });
  });
});
