import { describe, expect, it } from 'vitest';
import {
  buildYouTubeEmbedUrl,
  buildYouTubeWatchUrl,
  extractYouTubeVideoId,
  getYouTubeThumbnail,
  isYouTubeLiveUrl,
} from '@/lib/utils/youtube';

describe('YouTube & YouTube Live stream pipeline', () => {
  it('extracts video ID correctly from YouTube Live URLs', () => {
    expect(
      extractYouTubeVideoId('https://www.youtube.com/live/dQw4w9WgXcQ')
    ).toBe('dQw4w9WgXcQ');
    expect(
      extractYouTubeVideoId('https://youtube.com/live/dQw4w9WgXcQ?si=abcdef123456')
    ).toBe('dQw4w9WgXcQ');
    expect(
      extractYouTubeVideoId('https://m.youtube.com/live/dQw4w9WgXcQ?feature=share')
    ).toBe('dQw4w9WgXcQ');
  });

  it('extracts video ID from standard watch, shorts, and shortened URLs', () => {
    expect(
      extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    ).toBe('dQw4w9WgXcQ');
    expect(
      extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?si=789xyz')
    ).toBe('dQw4w9WgXcQ');
    expect(
      extractYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')
    ).toBe('dQw4w9WgXcQ');
    expect(
      extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')
    ).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('correctly identifies YouTube Live stream URLs', () => {
    expect(
      isYouTubeLiveUrl('https://www.youtube.com/live/dQw4w9WgXcQ')
    ).toBe(true);
    expect(
      isYouTubeLiveUrl('https://youtube.com/live/dQw4w9WgXcQ?si=xyz')
    ).toBe(true);
    expect(
      isYouTubeLiveUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    ).toBe(false);
  });

  it('generates high quality YouTube thumbnails automatically', () => {
    const liveUrl = 'https://www.youtube.com/live/dQw4w9WgXcQ';
    expect(getYouTubeThumbnail(liveUrl)).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
    );
    expect(getYouTubeThumbnail(liveUrl, 'max')).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
    );
  });

  it('builds optimized YouTube embed URLs with live & autoplay parameters', () => {
    const embedUrl = buildYouTubeEmbedUrl('dQw4w9WgXcQ', {
      isLive: true,
      autoplay: true,
      playsinline: true,
    });

    expect(embedUrl).toContain('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(embedUrl).toContain('live=1');
    expect(embedUrl).toContain('autoplay=1');
    expect(embedUrl).toContain('playsinline=1');
    expect(embedUrl).toContain('enablejsapi=1');
  });
});
