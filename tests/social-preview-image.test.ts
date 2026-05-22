import { describe, expect, it } from 'vitest';
import {
  buildArticleSocialPreview,
  buildEpaperSocialPreview,
} from '@/lib/server/socialPreviewImage';

function expectPngBuffer(value: Buffer) {
  expect(value.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  );
}

describe('social preview image renderer', () => {
  it('renders article and e-paper CTA preview PNGs', async () => {
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
});
