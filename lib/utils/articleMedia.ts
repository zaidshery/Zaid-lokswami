const CLOUDINARY_HOST_PATTERN = /(^|\.)res\.cloudinary\.com$/i;
const CLOUDINARY_IMAGE_UPLOAD_SEGMENT = '/image/upload/';
const CLOUDINARY_TRANSFORM_TOKEN =
  /(^|,)(?:c|w|h|ar|g|f|q|dpr|e|x|y|z|o|b|r|a)_/;

export type ArticleImageVariant =
  | 'hero'
  | 'card'
  | 'thumb'
  | 'featured'
  | 'detail'
  | 'story'
  | 'og';

const VARIANT_TRANSFORMS: Record<ArticleImageVariant, string> = {
  hero: 'c_fill,g_auto,w_1600,h_900,f_auto,q_auto,dpr_auto',
  card: 'c_fill,g_auto,w_1200,h_750,f_auto,q_auto,dpr_auto',
  thumb: 'c_fill,g_auto,w_640,h_400,f_auto,q_auto,dpr_auto',
  featured: 'c_fill,g_auto,w_1200,h_900,f_auto,q_auto,dpr_auto',
  detail: 'c_fill,g_auto,w_1920,h_1080,f_auto,q_auto,dpr_auto',
  story: 'c_fill,g_auto,w_1200,h_1200,f_auto,q_auto,dpr_auto',
  og: 'c_fill,g_auto,w_1200,h_630,f_jpg,q_auto',
};

function parseCloudinaryImageUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (!CLOUDINARY_HOST_PATTERN.test(parsed.hostname)) {
    return null;
  }

  if (!parsed.pathname.includes(CLOUDINARY_IMAGE_UPLOAD_SEGMENT)) {
    return null;
  }

  return parsed;
}

function hasCloudinaryTransform(uploadSuffix: string) {
  const firstSegment = uploadSuffix.split('/')[0] || '';
  if (!firstSegment) return false;
  if (/^v\d+$/.test(firstSegment)) return false;
  return CLOUDINARY_TRANSFORM_TOKEN.test(firstSegment);
}

export function applyCloudinaryImageTransform(value: string, transform: string) {
  const parsed = parseCloudinaryImageUrl(value);
  if (!parsed) return value.trim();

  const normalizedTransform = transform.trim().replace(/^\/+|\/+$/g, '');
  if (!normalizedTransform) return parsed.toString();

  const markerIndex = parsed.pathname.indexOf(CLOUDINARY_IMAGE_UPLOAD_SEGMENT);
  if (markerIndex < 0) return parsed.toString();

  const prefix = parsed.pathname.slice(
    0,
    markerIndex + CLOUDINARY_IMAGE_UPLOAD_SEGMENT.length
  );
  const uploadSuffix = parsed.pathname
    .slice(markerIndex + CLOUDINARY_IMAGE_UPLOAD_SEGMENT.length)
    .replace(/^\/+/, '');

  if (!uploadSuffix || hasCloudinaryTransform(uploadSuffix)) {
    return parsed.toString();
  }

  parsed.pathname = `${prefix}${normalizedTransform}/${uploadSuffix}`;
  return parsed.toString();
}

export function buildArticleImageVariantUrl(
  value: string,
  variant: ArticleImageVariant
) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return applyCloudinaryImageTransform(trimmed, VARIANT_TRANSFORMS[variant]);
}

type ResolveArticleOgImageInput = {
  ogImage?: string;
  image?: string;
};

export function resolveArticleOgImageUrl({
  ogImage,
  image,
}: ResolveArticleOgImageInput) {
  const preferred = (ogImage || '').trim() || (image || '').trim();
  if (!preferred) return '';
  return buildArticleImageVariantUrl(preferred, 'og');
}
