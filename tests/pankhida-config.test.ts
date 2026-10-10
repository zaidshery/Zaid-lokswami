import { describe, expect, it } from 'vitest';
import { normalizePankhidaConfig, validatePankhidaConfig } from '@/lib/pankhida/config';
import { buildYouTubeEmbedUrl, extractYouTubeVideoId } from '@/lib/utils/youtube';

describe('Pankhida 2026 stream settings', () => {
  it('starts upcoming without a player URL', () => {
    const config = normalizePankhidaConfig({});
    expect(config.status).toBe('upcoming');
    expect(config.youtubeUrl).toBe('');
    expect(validatePankhidaConfig(config)).toBeNull();
  });

  it('allows status updates for a CMS stream and validates a fallback URL when supplied', () => {
    const missing = normalizePankhidaConfig({ status: 'live' });
    expect(validatePankhidaConfig(missing)).toBeNull();
    const invalid = normalizePankhidaConfig({ status: 'ended', youtubeUrl: 'https://example.com/live/dQw4w9WgXcQ' });
    expect(validatePankhidaConfig(invalid)).toMatch(/valid YouTube/);
    const live = normalizePankhidaConfig({ status: 'live', youtubeUrl: 'https://www.youtube.com/live/dQw4w9WgXcQ' });
    expect(validatePankhidaConfig(live)).toBeNull();
    const videoId = extractYouTubeVideoId(live.youtubeUrl);
    expect(videoId).toBe('dQw4w9WgXcQ');
    expect(buildYouTubeEmbedUrl(videoId!, { isLive: true, autoplay: false, playsinline: true })).toContain('playsinline=1');
  });
});
