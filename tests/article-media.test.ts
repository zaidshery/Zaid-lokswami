import { describe, expect, it } from 'vitest';
import {
  ARTICLE_IMAGE_FALLBACK_SRC,
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

  it('uses the local placeholder instead of requesting legacy Cloudinary URLs', () => {
    const legacyUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';

    expect(resolveArticleImageSrc(legacyUrl)).toBe(ARTICLE_IMAGE_FALLBACK_SRC);
    expect(buildArticleImageVariantUrl(legacyUrl, 'thumb')).toBe(ARTICLE_IMAGE_FALLBACK_SRC);
  });

  it('keeps DigitalOcean article images unchanged', () => {
    const spacesUrl = 'https://lokswami-storage-2026.sgp1.cdn.digitaloceanspaces.com/lokswami/images/story.png';

    expect(resolveArticleImageSrc(spacesUrl)).toBe(spacesUrl);
    expect(resolveArticleOgImageUrl({ image: spacesUrl })).toBe(spacesUrl);
  });
});
