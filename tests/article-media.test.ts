import { describe, expect, it } from 'vitest';
import {
  buildArticleImageVariantUrl,
  isLegacyCloudinaryImageUrl,
  resolveArticleImageSrc,
  resolveArticleOgImageUrl,
} from '@/lib/utils/articleMedia';

describe('article media helpers', () => {
  it('detects legacy Cloudinary image URLs', () => {
    expect(isLegacyCloudinaryImageUrl('https://res.cloudinary.com/demo/image/upload/sample.jpg')).toBe(true);
    expect(isLegacyCloudinaryImageUrl('https://lokswami-storage-2026.sgp1.cdn.digitaloceanspaces.com/lokswami/image.jpg')).toBe(false);
  });

  it('keeps legacy Cloudinary URLs available for old published article thumbnails', () => {
    const legacyUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';

    expect(resolveArticleImageSrc(legacyUrl)).toBe(legacyUrl);
    expect(buildArticleImageVariantUrl(legacyUrl, 'thumb')).toBe(legacyUrl);
  });

  it('keeps DigitalOcean article images unchanged', () => {
    const spacesUrl = 'https://lokswami-storage-2026.sgp1.cdn.digitaloceanspaces.com/lokswami/images/story.png';

    expect(resolveArticleImageSrc(spacesUrl)).toBe(spacesUrl);
    expect(resolveArticleOgImageUrl({ image: spacesUrl })).toBe(spacesUrl);
  });
});
