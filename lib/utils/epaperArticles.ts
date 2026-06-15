import type { IEPaperArticleHotspot } from '@/lib/models/EPaperArticle';

export interface NormalizedHotspot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function buildEpaperPlaceholderTitle(pageNumber: number, ordinal: number) {
  const safePageNumber = Math.max(1, Math.floor(Number(pageNumber) || 1));
  const safeOrdinal = Math.max(1, Math.floor(Number(ordinal) || 1));
  return `Draft story - Page ${safePageNumber} #${safeOrdinal}`;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function toNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function normalizeHotspot(input: unknown): NormalizedHotspot {
  const source = typeof input === 'object' && input ? (input as Record<string, unknown>) : {};
  const x = clamp01(toNumber(source.x, 0));
  const y = clamp01(toNumber(source.y, 0));
  const w = clamp01(toNumber(source.w, 0.2));
  const h = clamp01(toNumber(source.h, 0.2));

  return {
    x: Number(x.toFixed(6)),
    y: Number(y.toFixed(6)),
    w: Number(Math.max(0.0001, Math.min(1 - x, w)).toFixed(6)),
    h: Number(Math.max(0.0001, Math.min(1 - y, h)).toFixed(6)),
  };
}

export function validateHotspot(hotspot: IEPaperArticleHotspot) {
  if (!Number.isFinite(hotspot.x) || hotspot.x < 0 || hotspot.x > 1) {
    return 'hotspot.x must be between 0 and 1';
  }
  if (!Number.isFinite(hotspot.y) || hotspot.y < 0 || hotspot.y > 1) {
    return 'hotspot.y must be between 0 and 1';
  }
  if (!Number.isFinite(hotspot.w) || hotspot.w <= 0 || hotspot.w > 1) {
    return 'hotspot.w must be between 0 and 1';
  }
  if (!Number.isFinite(hotspot.h) || hotspot.h <= 0 || hotspot.h > 1) {
    return 'hotspot.h must be between 0 and 1';
  }
  if (hotspot.x + hotspot.w > 1.000001) {
    return 'hotspot.x + hotspot.w must be <= 1';
  }
  if (hotspot.y + hotspot.h > 1.000001) {
    return 'hotspot.y + hotspot.h must be <= 1';
  }
  return null;
}

export function slugifyTitle(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 200);
}

export async function resolveUniqueSlug(
  requestedTitleOrSlug: string,
  exists: (candidate: string) => Promise<boolean>
) {
  const base = slugifyTitle(requestedTitleOrSlug) || 'article';
  let candidate = base;
  let suffix = 2;

  while (await exists(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
    if (suffix > 1000) break;
  }

  return candidate;
}
