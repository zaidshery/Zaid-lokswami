// Article media utilities for DigitalOcean Spaces URLs.
// Legacy Cloudinary URL support has been removed.
// All new media is stored on DigitalOcean Spaces CDN.

export type ArticleImageVariant =
  | 'hero'
  | 'card'
  | 'thumb'
  | 'featured'
  | 'detail'
  | 'story'
  | 'og';

/**
 * Returns the image URL unchanged.
 * DigitalOcean Spaces CDN serves images directly — no client-side transforms needed.
 * The `variant` parameter is kept in the signature for API compatibility.
 */
export function buildArticleImageVariantUrl(
  value: string,
  _variant: ArticleImageVariant
) {
  return value.trim();
}

type ResolveArticleOgImageInput = {
  ogImage?: string;
  image?: string;
};

export function resolveArticleOgImageUrl({
  ogImage,
  image,
}: ResolveArticleOgImageInput) {
  return (ogImage || '').trim() || (image || '').trim();
}
