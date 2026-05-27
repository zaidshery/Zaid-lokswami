import { describe, expect, it } from 'vitest';
import {
  buildEpaperSuggestionQuality,
  getEpaperHotspotOverlapRatio,
} from '@/lib/utils/epaperSuggestionQuality';

describe('e-paper OCR suggestion quality', () => {
  it('selects complete non-overlapping suggestions by default', () => {
    const quality = buildEpaperSuggestionQuality({
      title: 'Mumbai CNG price update',
      excerpt: 'A complete readable OCR excerpt for this mapped story from the e-paper page.',
      contentHtml:
        '<p>This story has enough clean article body text for a reviewer to create a draft.</p>',
      hotspot: { x: 0.1, y: 0.15, w: 0.3, h: 0.18 },
      existingStories: [],
    });

    expect(quality.shouldSelect).toBe(true);
    expect(quality.warnings).toEqual([]);
    expect(quality.confidence).toBeGreaterThanOrEqual(70);
  });

  it('blocks duplicate titles and heavily overlapping hotspots', () => {
    const quality = buildEpaperSuggestionQuality({
      title: 'Kota hospital update',
      excerpt: 'Readable OCR text from the same story.',
      contentHtml: '<p>Readable article body text is present for review.</p>',
      hotspot: { x: 0.11, y: 0.12, w: 0.2, h: 0.2 },
      existingStories: [
        {
          title: 'Kota hospital update',
          hotspot: { x: 0.1, y: 0.1, w: 0.22, h: 0.22 },
        },
      ],
    });

    expect(quality.shouldSelect).toBe(false);
    expect(quality.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(['duplicate_title', 'overlapping_hotspot'])
    );
  });

  it('marks missing text and tiny boxes as blocking warnings', () => {
    const quality = buildEpaperSuggestionQuality({
      title: '',
      excerpt: '',
      contentHtml: '',
      hotspot: { x: 0.4, y: 0.4, w: 0.01, h: 0.01 },
      existingStories: [],
    });

    expect(quality.shouldSelect).toBe(false);
    expect(quality.warnings.filter((warning) => warning.severity === 'blocking').length).toBe(3);
    expect(quality.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(['empty_title', 'empty_readable_text', 'tiny_hotspot'])
    );
  });

  it('calculates overlap against the smaller hotspot area', () => {
    expect(
      getEpaperHotspotOverlapRatio(
        { x: 0.1, y: 0.1, w: 0.4, h: 0.4 },
        { x: 0.2, y: 0.2, w: 0.1, h: 0.1 }
      )
    ).toBe(1);
  });
});
