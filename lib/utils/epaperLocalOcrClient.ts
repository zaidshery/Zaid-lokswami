'use client';

import {
  normalizeArticleHotspots,
  type EPaperArticleHotspot,
} from '@/lib/utils/epaperHotspots';

const TESSERACT_SCRIPT_URL =
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

interface LineBox {
  text: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  height: number;
}

interface TextBlock {
  lines: LineBox[];
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type EpaperCropOcrLine = {
  text: string;
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
  height?: number;
};

export type EpaperCropTextOcrResult = {
  plainText: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  lineCount: number;
  engine: 'local';
};

interface TesseractBBox {
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
}

interface TesseractLine {
  text?: string;
  bbox?: TesseractBBox;
}

interface TesseractData {
  lines?: TesseractLine[];
  text?: string;
  width?: number;
  height?: number;
}

interface TesseractResult {
  data?: TesseractData;
}

interface TesseractGlobal {
  recognize: (
    image: string,
    lang: string,
    options?: { logger?: (message: unknown) => void }
  ) => Promise<TesseractResult>;
}

declare global {
  interface Window {
    Tesseract?: TesseractGlobal;
  }
}

let loadPromise: Promise<TesseractGlobal> | null = null;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function cleanOcrTextLine(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function isIsolatedPageNoise(value: string) {
  const text = value.trim();
  return /^\d{1,3}$/.test(text) || /^page\s+\d{1,3}$/i.test(text);
}

function toCropOcrLines(lines: EpaperCropOcrLine[]) {
  return lines
    .map((line, index) => {
      const text = cleanOcrTextLine(String(line.text || ''));
      if (!text || isIsolatedPageNoise(text)) return null;

      const top = Number(line.top);
      const left = Number(line.left);
      const height = Number(line.height);
      return {
        text,
        top: Number.isFinite(top) ? top : index,
        left: Number.isFinite(left) ? left : 0,
        height: Number.isFinite(height) && height > 0 ? height : 14,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (!a || !b) return 0;
      return a.top === b.top ? a.left - b.left : a.top - b.top;
    }) as Array<{ text: string; top: number; left: number; height: number }>;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function trimToLength(value: string, maxLength: number) {
  const text = cleanOcrTextLine(value);
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).replace(/\s+\S*$/, '').trim() || text.slice(0, maxLength).trim();
}

function buildExcerpt(value: string) {
  return trimToLength(value.replace(/\s+/g, ' '), 180);
}

function pickHeadlineStart(lines: ReturnType<typeof toCropOcrLines>) {
  if (!lines.length) return -1;
  if (lines.length === 1) return 0;

  const topLines = lines.slice(0, Math.min(8, lines.length));
  const medianHeight = Math.max(1, median(lines.map((line) => line.height)));
  const firstHeight = topLines[0]?.height || medianHeight;
  const strongest = topLines.reduce(
    (best, line, index) =>
      line.height > best.line.height || (line.height === best.line.height && index < best.index)
        ? { line, index }
        : best,
    { line: topLines[0], index: 0 }
  );

  const isMeaningfullyLarger =
    strongest.line.height >= medianHeight * 1.2 && strongest.line.height >= firstHeight * 1.12;
  return isMeaningfullyLarger ? strongest.index : 0;
}

export function buildEpaperCropTextOcrResult(
  rawLines: EpaperCropOcrLine[]
): EpaperCropTextOcrResult {
  const lines = toCropOcrLines(rawLines);
  const plainText = lines.map((line) => line.text).join('\n').trim();
  if (!lines.length || !plainText) {
    return {
      plainText: '',
      title: '',
      excerpt: '',
      contentHtml: '',
      lineCount: 0,
      engine: 'local',
    };
  }

  const headlineStart = pickHeadlineStart(lines);
  const headlineLine = lines[headlineStart] || lines[0];
  const title = trimToLength(headlineLine.text, 160);
  const bodyLines = lines.filter((_, index) => index !== headlineStart).map((line) => line.text);
  let bodyText = bodyLines.join('\n').trim();
  if (bodyText.replace(/\s+/g, '').length < 40) {
    bodyText = plainText;
  }

  return {
    plainText,
    title,
    excerpt: buildExcerpt(bodyText || plainText),
    contentHtml: bodyText || plainText,
    lineCount: lines.length,
    engine: 'local',
  };
}

async function loadTesseract() {
  if (typeof window === 'undefined') {
    throw new Error('Local OCR is available only in browser');
  }

  if (window.Tesseract) return window.Tesseract;

  if (!loadPromise) {
    loadPromise = new Promise<TesseractGlobal>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[data-tesseract-loader="1"]'
      );

      const onReady = () => {
        if (!window.Tesseract) {
          reject(new Error('Failed to initialize local OCR'));
          return;
        }
        resolve(window.Tesseract);
      };

      if (existing) {
        existing.addEventListener('load', onReady, { once: true });
        existing.addEventListener(
          'error',
          () => reject(new Error('Failed to load local OCR script')),
          { once: true }
        );
        return;
      }

      const script = document.createElement('script');
      script.src = TESSERACT_SCRIPT_URL;
      script.async = true;
      script.dataset.tesseractLoader = '1';
      script.onload = onReady;
      script.onerror = () => reject(new Error('Failed to load local OCR script'));
      document.head.appendChild(script);
    }).catch((error) => {
      loadPromise = null;
      throw error;
    });
  }

  return loadPromise;
}

function buildLineBoxes(result: TesseractResult) {
  const rawLines = Array.isArray(result?.data?.lines) ? result.data!.lines! : [];
  const lines: LineBox[] = [];

  for (const rawLine of rawLines) {
    const text = String(rawLine?.text || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;

    const bbox = rawLine?.bbox || {};
    const left = Number(bbox.x0);
    const top = Number(bbox.y0);
    const right = Number(bbox.x1);
    const bottom = Number(bbox.y1);

    if (
      !Number.isFinite(left) ||
      !Number.isFinite(top) ||
      !Number.isFinite(right) ||
      !Number.isFinite(bottom)
    ) {
      continue;
    }
    if (right <= left || bottom <= top) continue;

    lines.push({
      text,
      left,
      top,
      right,
      bottom,
      height: bottom - top,
    });
  }

  return lines.sort((a, b) => (a.top === b.top ? a.left - b.left : a.top - b.top));
}

function overlapRatio(aLeft: number, aRight: number, bLeft: number, bRight: number) {
  const left = Math.max(aLeft, bLeft);
  const right = Math.min(aRight, bRight);
  if (right <= left) return 0;

  const overlap = right - left;
  const minWidth = Math.max(1, Math.min(aRight - aLeft, bRight - bLeft));
  return overlap / minWidth;
}

function groupLinesToBlocks(lines: LineBox[]) {
  const blocks: TextBlock[] = [];

  for (const line of lines) {
    let bestIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      const vGap = line.top - block.bottom;
      const hOverlap = overlapRatio(block.left, block.right, line.left, line.right);
      const threshold = Math.max(14, line.height * 1.35);
      if (vGap > threshold) continue;
      if (hOverlap < 0.24) continue;

      const score = Math.max(vGap, 0) + (1 - hOverlap) * 10;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    if (bestIndex === -1) {
      blocks.push({
        lines: [line],
        left: line.left,
        top: line.top,
        right: line.right,
        bottom: line.bottom,
      });
      continue;
    }

    const block = blocks[bestIndex];
    block.lines.push(line);
    block.left = Math.min(block.left, line.left);
    block.top = Math.min(block.top, line.top);
    block.right = Math.max(block.right, line.right);
    block.bottom = Math.max(block.bottom, line.bottom);
  }

  return blocks;
}

function blocksToHotspots(blocks: TextBlock[], pageWidth: number, pageHeight: number) {
  const candidates = blocks
    .map((block) => {
      const text = block.lines.map((line) => line.text).join('\n').trim();
      const title = block.lines[0]?.text?.trim() || '';
      const widthPx = block.right - block.left;
      const heightPx = block.bottom - block.top;
      const areaPx = widthPx * heightPx;
      return { block, text, title, areaPx };
    })
    .filter((item) => item.text.length >= 40 && item.areaPx >= 4000);

  candidates.sort((a, b) => b.areaPx - a.areaPx);
  const selected = candidates.slice(0, 40);

  const hotspots: EPaperArticleHotspot[] = selected.map((item, index) => {
    const paddingPx = 4;
    const left = clamp(item.block.left - paddingPx, 0, pageWidth);
    const top = clamp(item.block.top - paddingPx, 0, pageHeight);
    const right = clamp(item.block.right + paddingPx, 0, pageWidth);
    const bottom = clamp(item.block.bottom + paddingPx, 0, pageHeight);

    const x = clamp((left / pageWidth) * 100, 0, 100);
    const y = clamp((top / pageHeight) * 100, 0, 100);
    const width = clamp(((right - left) / pageWidth) * 100, 0.1, 100);
    const height = clamp(((bottom - top) / pageHeight) * 100, 0.1, 100);

    return {
      id: `local-${index + 1}`,
      title: item.title.slice(0, 180),
      text: '',
      page: 1,
      x: Number(x.toFixed(3)),
      y: Number(y.toFixed(3)),
      width: Number(width.toFixed(3)),
      height: Number(height.toFixed(3)),
    };
  });

  return normalizeArticleHotspots(hotspots);
}

function buildSyntheticLinesFromText(text: string): LineBox[] {
  return String(text || '')
    .split(/\r?\n/)
    .map((line, index) => {
      const cleaned = cleanOcrTextLine(line);
      if (!cleaned) return null;
      const top = index * 18;
      return {
        text: cleaned,
        left: 0,
        top,
        right: Math.max(1, cleaned.length * 8),
        bottom: top + 14,
        height: 14,
      };
    })
    .filter(Boolean) as LineBox[];
}

export async function recognizeEpaperCropTextLocally(
  imageSource: string,
  options?: { language?: string }
): Promise<EpaperCropTextOcrResult> {
  const source = imageSource.trim();
  if (!source) {
    throw new Error('Crop image is required for text extraction');
  }
  if (/\.pdf(\?|#|$)/i.test(source) || source.toLowerCase().startsWith('data:application/pdf')) {
    throw new Error('Crop OCR requires an image input');
  }

  const tesseract = await loadTesseract();
  const preferredLanguage = (options?.language || 'hin+eng').trim() || 'hin+eng';

  let result: TesseractResult;
  try {
    result = await tesseract.recognize(source, preferredLanguage, { logger: () => {} });
  } catch {
    if (preferredLanguage !== 'eng') {
      result = await tesseract.recognize(source, 'eng', { logger: () => {} });
    } else {
      throw new Error('Local OCR failed to recognize crop image');
    }
  }

  const lines = buildLineBoxes(result);
  const resultLines = lines.length ? lines : buildSyntheticLinesFromText(result?.data?.text || '');
  const extracted = buildEpaperCropTextOcrResult(resultLines);
  if (!extracted.lineCount || !extracted.plainText) {
    throw new Error('Could not read crop text. Paste text manually.');
  }

  return extracted;
}

export async function generateArticleHotspotsLocally(
  imageSource: string,
  options?: { language?: string }
) {
  const source = imageSource.trim();
  if (!source) {
    throw new Error('Thumbnail is required for local OCR');
  }
  if (/\.pdf(\?|#|$)/i.test(source) || source.toLowerCase().startsWith('data:application/pdf')) {
    throw new Error('Local OCR requires image input (JPG/PNG/data URL)');
  }

  const tesseract = await loadTesseract();
  const preferredLanguage = (options?.language || 'hin+eng').trim() || 'hin+eng';

  let result: TesseractResult;
  try {
    result = await tesseract.recognize(source, preferredLanguage, { logger: () => {} });
  } catch {
    if (preferredLanguage !== 'eng') {
      result = await tesseract.recognize(source, 'eng', { logger: () => {} });
    } else {
      throw new Error('Local OCR failed to recognize image');
    }
  }

  const lines = buildLineBoxes(result);
  if (!lines.length) return [];

  const widthFromResult = Number(result?.data?.width);
  const heightFromResult = Number(result?.data?.height);
  const pageWidth = Number.isFinite(widthFromResult)
    ? Math.max(1, widthFromResult)
    : Math.max(...lines.map((line) => line.right));
  const pageHeight = Number.isFinite(heightFromResult)
    ? Math.max(1, heightFromResult)
    : Math.max(...lines.map((line) => line.bottom));

  const blocks = groupLinesToBlocks(lines);
  return blocksToHotspots(blocks, pageWidth, pageHeight);
}
