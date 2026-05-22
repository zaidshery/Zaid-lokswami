// Article media utilities for DigitalOcean Spaces URLs.
// New durable media belongs on DigitalOcean Spaces. Legacy Cloudinary URLs may
// still exist in old published articles and should render until those records
// are migrated.

export type ArticleImageVariant =
  | 'hero'
  | 'card'
  | 'thumb'
  | 'featured'
  | 'detail'
  | 'story'
  | 'og';

export const ARTICLE_IMAGE_FALLBACK_SRC = '/placeholders/news-16x9.svg';

export function isLegacyCloudinaryImageUrl(value?: string | null) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return false;

  try {
    const parsed = new URL(normalized);
    return parsed.hostname === 'cloudinary.com' || parsed.hostname.endsWith('.cloudinary.com');
  } catch {
    return normalized.includes('res.cloudinary.com') || normalized.includes('cloudinary.com/');
  }
}

export function resolveArticleImageSrc(
  value?: string | null,
  fallbackSrc = ARTICLE_IMAGE_FALLBACK_SRC
) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return fallbackSrc;
  }

  return normalized;
}

/**
 * Returns a safe article image URL for the reader.
 * DigitalOcean Spaces CDN serves images directly, with no client-side transforms needed.
 * The `variant` parameter is kept in the signature for API compatibility.
 */
export function buildArticleImageVariantUrl(
  value: string,
  variant: ArticleImageVariant
) {
  void variant;
  return resolveArticleImageSrc(value);
}

type ResolveArticleOgImageInput = {
  ogImage?: string;
  image?: string;
};

export function resolveArticleOgImageUrl({
  ogImage,
  image,
}: ResolveArticleOgImageInput) {
  const resolvedOgImage = resolveArticleImageSrc(ogImage, '');
  if (resolvedOgImage) return resolvedOgImage;

  return resolveArticleImageSrc(image, '');
}
