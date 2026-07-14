export type ArticleMediaMetadata = {
  sourceMediaId: string;
  focalPointX: number;
  focalPointY: number;
  width: number;
  height: number;
  format: string;
  variants: {
    landscape16x9: string;
    standard4x3: string;
    square1x1: string;
    webp: string;
    avif: string;
  };
};

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function positiveNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function focalPoint(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

export function createEmptyArticleMediaMetadata(): ArticleMediaMetadata {
  return {
    sourceMediaId: '',
    focalPointX: 50,
    focalPointY: 50,
    width: 0,
    height: 0,
    format: '',
    variants: {
      landscape16x9: '',
      standard4x3: '',
      square1x1: '',
      webp: '',
      avif: '',
    },
  };
}

export function normalizeArticleMediaMetadata(input: unknown): ArticleMediaMetadata {
  const source = typeof input === 'object' && input ? (input as Record<string, unknown>) : {};
  const variants =
    typeof source.variants === 'object' && source.variants
      ? (source.variants as Record<string, unknown>)
      : {};
  return {
    sourceMediaId: text(source.sourceMediaId),
    focalPointX: focalPoint(source.focalPointX),
    focalPointY: focalPoint(source.focalPointY),
    width: positiveNumber(source.width),
    height: positiveNumber(source.height),
    format: text(source.format),
    variants: {
      landscape16x9: text(variants.landscape16x9),
      standard4x3: text(variants.standard4x3),
      square1x1: text(variants.square1x1),
      webp: text(variants.webp),
      avif: text(variants.avif),
    },
  };
}

export function validateArticleMediaMetadata(meta: ArticleMediaMetadata) {
  if (meta.format.length > 32) return 'Image format is too long';
  if (meta.sourceMediaId.length > 200) return 'Media library ID is too long';
  return null;
}
