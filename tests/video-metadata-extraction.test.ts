import { describe, expect, it } from 'vitest';
import {
  classifyVideoAspectRatio,
  formatStoryVideoSize,
  generateVideoSlug,
  validateStoryVideoFile,
} from '@/lib/utils/storyVideoUploadClient';

describe('Video Metadata Extraction & Classification', () => {
  describe('classifyVideoAspectRatio', () => {
    it('correctly classifies 9:16 vertical shorts (e.g. 1080x1920)', () => {
      const result = classifyVideoAspectRatio(1080, 1920);
      expect(result.aspectRatio).toBe('9:16');
      expect(result.isShort).toBe(true);
    });

    it('correctly classifies 720x1280 vertical video as 9:16 and short', () => {
      const result = classifyVideoAspectRatio(720, 1280);
      expect(result.aspectRatio).toBe('9:16');
      expect(result.isShort).toBe(true);
    });

    it('correctly classifies 16:9 landscape standard video (e.g. 1920x1080)', () => {
      const result = classifyVideoAspectRatio(1920, 1080);
      expect(result.aspectRatio).toBe('16:9');
      expect(result.isShort).toBe(false);
    });

    it('correctly classifies 1:1 square video (e.g. 1080x1080)', () => {
      const result = classifyVideoAspectRatio(1080, 1080);
      expect(result.aspectRatio).toBe('1:1');
      expect(result.isShort).toBe(false);
    });

    it('handles non-finite or invalid dimensions safely', () => {
      expect(classifyVideoAspectRatio(0, 0)).toEqual({ aspectRatio: 'unknown', isShort: false });
      expect(classifyVideoAspectRatio(-100, 200)).toEqual({ aspectRatio: 'unknown', isShort: false });
      expect(classifyVideoAspectRatio(NaN, 1080)).toEqual({ aspectRatio: 'unknown', isShort: false });
    });
  });

  describe('generateVideoSlug', () => {
    it('converts English title to kebab-case slug', () => {
      expect(generateVideoSlug('Indore Metro Trial Run 2026!')).toBe('indore-metro-trial-run-2026');
    });

    it('preserves Hindi unicode letters cleanly for news titles', () => {
      const slug = generateVideoSlug('इंदौर में मेट्रो का नया ट्रायल रन शुरू');
      expect(slug).toBe('इंदौर-में-मेट्रो-का-नया-ट्रायल-रन-शुरू');
    });

    it('strips unwanted punctuation and excessive hyphens', () => {
      const slug = generateVideoSlug('Breaking: Big Update... @ Indore ## 2026!');
      expect(slug).toBe('breaking-big-update-indore-2026');
    });

    it('handles empty titles with fallback', () => {
      const slug = generateVideoSlug('   ');
      expect(slug).toMatch(/^video-\d+$/);
    });
  });

  describe('formatStoryVideoSize', () => {
    it('formats bytes into readable MB / GB strings', () => {
      expect(formatStoryVideoSize(1024 * 1024 * 15)).toBe('15.00 MB');
      expect(formatStoryVideoSize(1024 * 1024 * 1024 * 1.5)).toBe('1.50 GB');
      expect(formatStoryVideoSize(0)).toBe('0 MB');
    });
  });

  describe('validateStoryVideoFile', () => {
    it('allows valid MP4 files', () => {
      const file = { name: 'news-reel.mp4', type: 'video/mp4', size: 1024 * 1024 * 25 } as File;
      expect(validateStoryVideoFile(file)).toBeNull();
    });

    it('rejects non-MP4 formats', () => {
      const file = { name: 'audio.mp3', type: 'audio/mp3', size: 1024 * 1024 } as File;
      expect(validateStoryVideoFile(file)).toBe('Video must be an MP4 file.');
    });
  });
});
