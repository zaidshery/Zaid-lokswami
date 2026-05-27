export type EpaperSuggestionHotspot = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type EpaperSuggestionWarningCode =
  | 'empty_title'
  | 'empty_readable_text'
  | 'low_readable_text'
  | 'tiny_hotspot'
  | 'out_of_page_hotspot'
  | 'duplicate_title'
  | 'overlapping_hotspot';

export type EpaperSuggestionWarning = {
  code: EpaperSuggestionWarningCode;
  label: string;
  severity: 'warning' | 'blocking';
};

export type ExistingEpaperStoryForSuggestion = {
  title?: string | null;
  hotspot?: EpaperSuggestionHotspot | null;
};

export type EpaperSuggestionQualityInput = {
  title: string;
  excerpt?: string;
  contentHtml?: string;
  hotspot: EpaperSuggestionHotspot;
  existingStories?: ExistingEpaperStoryForSuggestion[];
};

export type EpaperSuggestionQuality = {
  confidence: number;
  warnings: EpaperSuggestionWarning[];
  shouldSelect: boolean;
  maxOverlapRatio: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeTitle(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(input: string) {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function readableTextLength(input: Pick<EpaperSuggestionQualityInput, 'excerpt' | 'contentHtml'>) {
  const excerpt = String(input.excerpt || '').trim();
  const body = stripHtml(String(input.contentHtml || ''));
  return `${excerpt} ${body}`.trim().length;
}

function hasOutOfPageBounds(hotspot: EpaperSuggestionHotspot) {
  return (
    !Number.isFinite(hotspot.x) ||
    !Number.isFinite(hotspot.y) ||
    !Number.isFinite(hotspot.w) ||
    !Number.isFinite(hotspot.h) ||
    hotspot.x < 0 ||
    hotspot.y < 0 ||
    hotspot.w <= 0 ||
    hotspot.h <= 0 ||
    hotspot.x + hotspot.w > 1.000001 ||
    hotspot.y + hotspot.h > 1.000001
  );
}

export function getEpaperHotspotOverlapRatio(
  a: EpaperSuggestionHotspot,
  b: EpaperSuggestionHotspot
) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);

  if (right <= left || bottom <= top) return 0;

  const intersection = (right - left) * (bottom - top);
  const aArea = Math.max(0.000001, a.w * a.h);
  const bArea = Math.max(0.000001, b.w * b.h);

  return clamp(intersection / Math.min(aArea, bArea), 0, 1);
}

export function buildEpaperSuggestionQuality(
  input: EpaperSuggestionQualityInput
): EpaperSuggestionQuality {
  const warnings: EpaperSuggestionWarning[] = [];
  const title = String(input.title || '').trim();
  const titleKey = normalizeTitle(title);
  const textLength = readableTextLength(input);
  const area = Math.max(0, input.hotspot.w * input.hotspot.h);
  const isTinyHotspot = area < 0.0025 || input.hotspot.w < 0.018 || input.hotspot.h < 0.018;
  const isOutOfPage = hasOutOfPageBounds(input.hotspot);
  const existingStories = input.existingStories || [];
  const hasDuplicateTitle =
    Boolean(titleKey) &&
    existingStories.some((story) => normalizeTitle(String(story.title || '')) === titleKey);
  const maxOverlapRatio = existingStories.reduce((max, story) => {
    if (!story.hotspot) return max;
    return Math.max(max, getEpaperHotspotOverlapRatio(input.hotspot, story.hotspot));
  }, 0);

  let confidence = 100;

  if (!title) {
    confidence -= 35;
    warnings.push({
      code: 'empty_title',
      label: 'Missing headline',
      severity: 'blocking',
    });
  }

  if (textLength === 0) {
    confidence -= 30;
    warnings.push({
      code: 'empty_readable_text',
      label: 'No readable text',
      severity: 'blocking',
    });
  } else if (textLength < 80) {
    confidence -= 12;
    warnings.push({
      code: 'low_readable_text',
      label: 'Short OCR text',
      severity: 'warning',
    });
  }

  if (isTinyHotspot) {
    confidence -= 28;
    warnings.push({
      code: 'tiny_hotspot',
      label: 'Hotspot too small',
      severity: 'blocking',
    });
  }

  if (isOutOfPage) {
    confidence -= 35;
    warnings.push({
      code: 'out_of_page_hotspot',
      label: 'Box leaves page',
      severity: 'blocking',
    });
  }

  if (hasDuplicateTitle) {
    confidence -= 25;
    warnings.push({
      code: 'duplicate_title',
      label: 'Similar headline exists',
      severity: 'blocking',
    });
  }

  if (maxOverlapRatio >= 0.55) {
    confidence -= 32;
    warnings.push({
      code: 'overlapping_hotspot',
      label: 'Overlaps mapped story',
      severity: 'blocking',
    });
  }

  const normalizedConfidence = Math.round(clamp(confidence, 5, 99));
  const hasBlockingWarning = warnings.some((warning) => warning.severity === 'blocking');

  return {
    confidence: normalizedConfidence,
    warnings,
    shouldSelect: normalizedConfidence >= 70 && !hasBlockingWarning,
    maxOverlapRatio: Number(maxOverlapRatio.toFixed(3)),
  };
}
