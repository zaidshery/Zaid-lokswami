import { describe, expect, it } from 'vitest';
import { calculateEpaperHotspotCrop } from '@/lib/utils/epaperHotspotCrop';

describe('e-paper hotspot crop math', () => {
  it('converts normalized hotspot coordinates into pixel crop coordinates', () => {
    expect(
      calculateEpaperHotspotCrop({
        pageWidth: 1000,
        pageHeight: 2000,
        hotspot: { x: 0.1, y: 0.2, w: 0.3, h: 0.25 },
        paddingMode: 'tight',
      })
    ).toEqual({
      left: 98,
      top: 397,
      width: 304,
      height: 506,
      right: 402,
      bottom: 903,
    });
  });

  it('uses tight padding by default', () => {
    expect(
      calculateEpaperHotspotCrop({
        pageWidth: 1000,
        pageHeight: 2000,
        hotspot: { x: 0.1, y: 0.2, w: 0.3, h: 0.25 },
      })
    ).toMatchObject({
      left: 98,
      top: 397,
      width: 304,
      height: 506,
    });
  });

  it('uses normal padding based on hotspot box size', () => {
    expect(
      calculateEpaperHotspotCrop({
        pageWidth: 1000,
        pageHeight: 2000,
        hotspot: { x: 0.1, y: 0.2, w: 0.3, h: 0.25 },
        paddingMode: 'normal',
      })
    ).toMatchObject({
      left: 94,
      top: 390,
      width: 312,
      height: 520,
    });
  });

  it('uses loose padding based on hotspot box size with a max cap', () => {
    expect(
      calculateEpaperHotspotCrop({
        pageWidth: 2000,
        pageHeight: 3000,
        hotspot: { x: 0.1, y: 0.2, w: 0.6, h: 0.5 },
        paddingMode: 'loose',
      })
    ).toMatchObject({
      left: 176,
      top: 576,
      width: 1248,
      height: 1548,
    });
  });

  it('clamps padded crop boundaries inside the page image', () => {
    expect(
      calculateEpaperHotspotCrop({
        pageWidth: 1000,
        pageHeight: 2000,
        hotspot: { x: 0, y: 0.95, w: 0.12, h: 0.05 },
        paddingMode: 'loose',
      })
    ).toEqual({
      left: 0,
      top: 1896,
      width: 125,
      height: 104,
      right: 125,
      bottom: 2000,
    });
  });

  it('rejects tiny original hotspot selections before padding can hide them', () => {
    expect(() =>
      calculateEpaperHotspotCrop({
        pageWidth: 1000,
        pageHeight: 2000,
        hotspot: { x: 0.3, y: 0.3, w: 0.01, h: 0.01 },
      })
    ).toThrow('Crop area is too small');
  });
});
