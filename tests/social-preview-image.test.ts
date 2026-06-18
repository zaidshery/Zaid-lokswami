import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  buildArticleSocialPreview,
  buildEpaperSocialPreview,
} from '@/lib/server/socialPreviewImage';

function expectPngBuffer(value: Buffer) {
  expect(value.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  );
}

function svgDataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function expectPreviewSize(value: Buffer) {
  const metadata = await sharp(value).metadata();
  expect(metadata.width).toBe(1200);
  expect(metadata.height).toBe(630);
}

async function readRgb(value: Buffer, x: number, y: number) {
  const { data, info } = await sharp(value).raw().toBuffer({ resolveWithObject: true });
  const index = (y * info.width + x) * info.channels;
  return [data[index], data[index + 1], data[index + 2]];
}

function expectRgbNear(actual: number[], expected: number[], tolerance = 2) {
  expect(actual[0]).toBeGreaterThanOrEqual(expected[0] - tolerance);
  expect(actual[0]).toBeLessThanOrEqual(expected[0] + tolerance);
  expect(actual[1]).toBeGreaterThanOrEqual(expected[1] - tolerance);
  expect(actual[1]).toBeLessThanOrEqual(expected[1] + tolerance);
  expect(actual[2]).toBeGreaterThanOrEqual(expected[2] - tolerance);
  expect(actual[2]).toBeLessThanOrEqual(expected[2] + tolerance);
}

describe('social preview image renderer', () => {
  it('renders article and e-paper media preview PNGs', async () => {
    const articleImage = await buildArticleSocialPreview({
      title: 'Indore civic update reaches readers',
      description: 'Officials shared the latest traffic and public service details.',
      imageUrl: '/lokswami-share-preview.png',
      label: 'Regional',
    });
    const epaperImage = await buildEpaperSocialPreview({
      title: 'Lokswami - Indore Edition',
      cityLabel: 'Indore',
      dateLabel: '22/05/26',
      imageUrl: '/placeholders/epaper-3x4.svg',
    });

    expectPngBuffer(articleImage);
    expectPngBuffer(epaperImage);
    await expectPreviewSize(articleImage);
    await expectPreviewSize(epaperImage);
  });

  it('renders fallback-safe preview PNGs for Hindi social text', async () => {
    const articleImage = await buildArticleSocialPreview({
      title: 'चुनाव नतीजे RESULT 2026 LIVE',
      description: 'लोकस्वामी पर देखें लाइव नतीजे और ताजा अपडेट',
      imageUrl: '/lokswami-share-preview.png',
      label: 'राष्ट्रीय',
    });
    const epaperImage = await buildEpaperSocialPreview({
      title: 'इंदौर संस्करण लोकस्वामी ई-पेपर',
      cityLabel: 'Indore',
      dateLabel: '22/05/26',
      imageUrl: '/placeholders/epaper-3x4.svg',
    });

    expectPngBuffer(articleImage);
    expectPngBuffer(epaperImage);
  });

  it('renders article previews as full-frame media without a side text panel', async () => {
    const articleImage = await buildArticleSocialPreview({
      title: 'Clean media card',
      description: 'The shared image should be the canonical thumbnail only.',
      imageUrl: svgDataUri(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#1e40af"/></svg>'
      ),
      label: 'Regional',
    });

    expectPngBuffer(articleImage);
    await expectPreviewSize(articleImage);
    expectRgbNear(await readRgb(articleImage, 80, 315), [30, 64, 175]);
    expectRgbNear(await readRgb(articleImage, 1080, 315), [30, 64, 175]);
  });

  it('renders e-paper previews as cover media without side padding', async () => {
    const epaperImage = await buildEpaperSocialPreview({
      title: 'Lokswami - Indore Edition',
      cityLabel: 'Indore',
      dateLabel: '22/05/26',
      imageUrl: svgDataUri(
        '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="900" height="1200" fill="#15803d"/></svg>'
      ),
    });

    expectPngBuffer(epaperImage);
    await expectPreviewSize(epaperImage);
    expectRgbNear(await readRgb(epaperImage, 600, 315), [21, 128, 61]);
    expectRgbNear(await readRgb(epaperImage, 1080, 315), [21, 128, 61]);
  });
});
