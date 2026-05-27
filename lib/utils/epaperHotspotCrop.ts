export type EpaperHotspotCropInput = {
  pageWidth: number;
  pageHeight: number;
  hotspot: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  paddingMode?: EpaperHotspotCropPaddingMode;
  minSidePx?: number;
};

export type EpaperHotspotCropPaddingMode = 'tight' | 'normal' | 'loose';

export type EpaperHotspotCropBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

export const EPAPER_HOTSPOT_CROP_MIN_SIDE_PX = 24;

const PADDING_MODE_CONFIG: Record<
  EpaperHotspotCropPaddingMode,
  { ratio: number; maxPx: number }
> = {
  tight: { ratio: 0.005, maxPx: 6 },
  normal: { ratio: 0.02, maxPx: 16 },
  loose: { ratio: 0.04, maxPx: 24 },
};

function isFinitePositive(value: number) {
  return Number.isFinite(value) && value > 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resolvePaddingMode(value: unknown): EpaperHotspotCropPaddingMode {
  return value === 'normal' || value === 'loose' ? value : 'tight';
}

function validateNormalizedHotspot(hotspot: EpaperHotspotCropInput['hotspot']) {
  if (
    !Number.isFinite(hotspot.x) ||
    !Number.isFinite(hotspot.y) ||
    !Number.isFinite(hotspot.w) ||
    !Number.isFinite(hotspot.h)
  ) {
    throw new Error('Hotspot values must be finite numbers.');
  }
  if (hotspot.x < 0 || hotspot.y < 0 || hotspot.w <= 0 || hotspot.h <= 0) {
    throw new Error('Hotspot coordinates must be positive normalized values.');
  }
  if (hotspot.x > 1 || hotspot.y > 1 || hotspot.x + hotspot.w > 1.000001 || hotspot.y + hotspot.h > 1.000001) {
    throw new Error('Hotspot must stay inside the page.');
  }
}

export function calculateEpaperHotspotCrop(input: EpaperHotspotCropInput): EpaperHotspotCropBox {
  const pageWidth = Math.floor(input.pageWidth);
  const pageHeight = Math.floor(input.pageHeight);
  if (!isFinitePositive(pageWidth) || !isFinitePositive(pageHeight)) {
    throw new Error('Page image dimensions are invalid.');
  }

  validateNormalizedHotspot(input.hotspot);

  const minSidePx = Math.max(1, Math.floor(input.minSidePx || EPAPER_HOTSPOT_CROP_MIN_SIDE_PX));
  const originalWidth = input.hotspot.w * pageWidth;
  const originalHeight = input.hotspot.h * pageHeight;
  if (originalWidth < minSidePx || originalHeight < minSidePx) {
    throw new Error(`Crop area is too small. Select at least ${minSidePx}px by ${minSidePx}px.`);
  }

  const paddingConfig = PADDING_MODE_CONFIG[resolvePaddingMode(input.paddingMode)];
  const paddingX = Math.min(originalWidth * paddingConfig.ratio, paddingConfig.maxPx);
  const paddingY = Math.min(originalHeight * paddingConfig.ratio, paddingConfig.maxPx);

  const left = clamp(Math.floor(input.hotspot.x * pageWidth - paddingX), 0, pageWidth - 1);
  const top = clamp(Math.floor(input.hotspot.y * pageHeight - paddingY), 0, pageHeight - 1);
  const right = clamp(Math.ceil((input.hotspot.x + input.hotspot.w) * pageWidth + paddingX), left + 1, pageWidth);
  const bottom = clamp(Math.ceil((input.hotspot.y + input.hotspot.h) * pageHeight + paddingY), top + 1, pageHeight);
  const width = right - left;
  const height = bottom - top;

  if (width < minSidePx || height < minSidePx) {
    throw new Error(`Crop area is too small. Select at least ${minSidePx}px by ${minSidePx}px.`);
  }

  return {
    left,
    top,
    width,
    height,
    right,
    bottom,
  };
}
