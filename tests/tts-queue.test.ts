import { describe, expect, it } from 'vitest';
import { TTS_ASSET_STATUSES } from '@/lib/types/tts';

describe('TTS queue public states', () => {
  it('supports a processing state for queued async audio work', () => {
    expect(TTS_ASSET_STATUSES).toContain('pending');
    expect(TTS_ASSET_STATUSES).toContain('processing');
    expect(TTS_ASSET_STATUSES).toContain('ready');
    expect(TTS_ASSET_STATUSES).toContain('failed');
  });
});

