import { describe, expect, it } from 'vitest';
import { TTS_ASSET_STATUSES, TTS_PROVIDERS } from '@/lib/types/tts';

describe('TTS queue public states', () => {
  it('supports a processing state for queued async audio work', () => {
    expect(TTS_ASSET_STATUSES).toContain('pending');
    expect(TTS_ASSET_STATUSES).toContain('processing');
    expect(TTS_ASSET_STATUSES).toContain('ready');
    expect(TTS_ASSET_STATUSES).toContain('failed');
  });

  it('supports manual audio as an authoritative TTS provider', () => {
    expect(TTS_PROVIDERS).toContain('gemini');
    expect(TTS_PROVIDERS).toContain('manual');
  });
});
