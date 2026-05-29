import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { buildEpaperCropOcrImageSource } from '@/lib/server/epaperOcrPreprocess';

async function buildTestImage(width: number, height: number) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#ffffff',
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="${width}" height="${height}" fill="white"/>
            <text x="20" y="80" font-size="42" fill="black">OCR TEST 123</text>
          </svg>`
        ),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();
}

describe('e-paper OCR crop preprocessing', () => {
  it('returns a temporary PNG data URL for OCR without a stored cover path', async () => {
    const image = await buildTestImage(400, 300);
    const result = await buildEpaperCropOcrImageSource(image, {
      left: 0,
      top: 0,
      width: 200,
      height: 120,
    });

    expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.dataUrl).not.toContain('lokswami-storage');
    expect(result.width).toBe(500);
    expect(result.height).toBe(300);
  });

  it('caps OCR preprocessing output width', async () => {
    const image = await buildTestImage(1600, 900);
    const result = await buildEpaperCropOcrImageSource(image, {
      left: 0,
      top: 0,
      width: 1200,
      height: 300,
    });

    expect(result.width).toBe(2400);
    expect(result.height).toBe(600);
  });
});
