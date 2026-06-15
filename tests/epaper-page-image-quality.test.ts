import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildEpaperLowResolutionWarning,
  normalizeEpaperPageImage,
  resolveEpaperPageResizeDimensions,
  resolveEpaperPreviewMaxZoom,
  resolveEpaperTouchPreviewMaxZoom,
} from '@/lib/utils/epaperPageImage';
import { buildPdfToJpgCommand } from '@/lib/utils/epaperPageImageGeneration';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function installImageMocks(options: {
  width: number;
  height: number;
  webpSupported: boolean;
}) {
  class FakeImage {
    naturalWidth = options.width;
    naturalHeight = options.height;
    width = options.width;
    height = options.height;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    set src(_value: string) {
      this.onload?.();
    }
  }

  vi.stubGlobal('Image', FakeImage);
  Object.defineProperty(window.URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:epaper-page'),
  });
  Object.defineProperty(window.URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });

  const context = {
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    drawImage: vi.fn(),
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
    toBlob: vi.fn(
      (
        callback: (blob: Blob | null) => void,
        mimeType: string
      ) => {
        const resolvedType =
          mimeType === 'image/webp' && !options.webpSupported
            ? 'image/png'
            : mimeType;
        callback(new Blob(['encoded'], { type: resolvedType }));
      }
    ),
  };
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    if (tagName.toLowerCase() === 'canvas') {
      return canvas as unknown as HTMLCanvasElement;
    }
    return originalCreateElement(tagName);
  });

  return { canvas, context };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('e-paper page image quality profile', () => {
  it('uses adaptive 300%, 350%, and 400% zoom bands', () => {
    expect(resolveEpaperPreviewMaxZoom(undefined)).toBe(3);
    expect(resolveEpaperPreviewMaxZoom(2199)).toBe(3);
    expect(resolveEpaperPreviewMaxZoom(2200)).toBe(3.5);
    expect(resolveEpaperPreviewMaxZoom(2799)).toBe(3.5);
    expect(resolveEpaperPreviewMaxZoom(2800)).toBe(4);
  });

  it('allows 500% touch zoom for high-resolution page images', () => {
    expect(resolveEpaperTouchPreviewMaxZoom(undefined)).toBe(3);
    expect(resolveEpaperTouchPreviewMaxZoom(2199)).toBe(3);
    expect(resolveEpaperTouchPreviewMaxZoom(2200)).toBe(3.5);
    expect(resolveEpaperTouchPreviewMaxZoom(2799)).toBe(3.5);
    expect(resolveEpaperTouchPreviewMaxZoom(2800)).toBe(5);
    expect(resolveEpaperTouchPreviewMaxZoom(3000)).toBe(5);
  });

  it('never upscales and only resizes pages wider than 3200px', () => {
    expect(resolveEpaperPageResizeDimensions(2100, 3150)).toEqual({
      width: 2100,
      height: 3150,
      resized: false,
    });
    expect(resolveEpaperPageResizeDimensions(3200, 4800)).toEqual({
      width: 3200,
      height: 4800,
      resized: false,
    });
    expect(resolveEpaperPageResizeDimensions(4000, 6000)).toEqual({
      width: 3000,
      height: 4500,
      resized: true,
    });
  });

  it('normalizes oversized uploads to a 3000px WebP at 90% quality', async () => {
    const { canvas, context } = installImageMocks({
      width: 4000,
      height: 6000,
      webpSupported: true,
    });
    const input = new File(['source'], 'page-one.png', {
      type: 'image/png',
      lastModified: 123,
    });

    const result = await normalizeEpaperPageImage(input);

    expect(result.file.name).toBe('page-one.webp');
    expect(result.file.type).toBe('image/webp');
    expect(result.width).toBe(3000);
    expect(result.height).toBe(4500);
    expect(result.resized).toBe(true);
    expect(canvas.width).toBe(3000);
    expect(canvas.height).toBe(4500);
    expect(context.drawImage).toHaveBeenCalled();
    expect(canvas.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/webp',
      0.9
    );
  });

  it('falls back to JPEG without enlarging a smaller upload', async () => {
    const { canvas } = installImageMocks({
      width: 2000,
      height: 3000,
      webpSupported: false,
    });
    const input = new File(['source'], 'page-two.png', { type: 'image/png' });

    const result = await normalizeEpaperPageImage(input);

    expect(result.file.name).toBe('page-two.jpg');
    expect(result.file.type).toBe('image/jpeg');
    expect(result.width).toBe(2000);
    expect(result.height).toBe(3000);
    expect(result.resized).toBe(false);
    expect(result.isLowResolution).toBe(true);
    expect(canvas.toBlob).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      'image/jpeg',
      0.9
    );
  });

  it('provides a clear low-resolution warning', () => {
    expect(buildEpaperLowResolutionWarning(2, 1800)).toContain(
      'Page 2 is 1800px wide'
    );
    expect(buildEpaperLowResolutionWarning(2, 1800)).toContain('limited to 300%');
  });

  it('wires normalized dimensions into both manual upload flows', () => {
    const createPage = read('app/(admin)/admin/epapers/new/page.tsx');
    const editPage = read('app/(admin)/admin/epapers/[id]/page.tsx');

    for (const source of [createPage, editPage]) {
      expect(source).toContain('normalizeEpaperPageImage(file)');
      expect(source).toContain('file: normalized.file');
      expect(source).toContain('width: normalized.width');
      expect(source).toContain('height: normalized.height');
    }
  });

  it('automatically renders direct PDF uploads into 3000px page images', () => {
    const createPage = read('app/(admin)/admin/epapers/new/page.tsx');

    expect(createPage).toContain('getPdfFilePageCount(pdfFile)');
    expect(createPage).toContain('renderPdfFilePages(pdfFile');
    expect(createPage).toContain('targetWidth: EPAPER_PAGE_TARGET_WIDTH');
    expect(createPage).toContain('jpegQuality: EPAPER_PAGE_IMAGE_QUALITY');
    expect(createPage).toContain('width: input.width');
    expect(createPage).toContain('height: input.height');
  });

  it('renders generated PDF pages at 3000px, 220 DPI, and JPEG quality 90', () => {
    const poppler = buildPdfToJpgCommand(
      'pdftoppm',
      '/storage/edition.pdf',
      12,
      '/tmp/pages'
    );
    expect(poppler.command).toBe('pdftoppm');
    expect(poppler.args).toEqual(
      expect.arrayContaining([
        '-r',
        '220',
        '-scale-to-x',
        '3000',
        '-scale-to-y',
        '-1',
        '-jpegopt',
        'quality=90',
      ])
    );

    const imageMagick = buildPdfToJpgCommand(
      'magick',
      '/storage/edition.pdf',
      12,
      '/tmp/pages'
    );
    expect(imageMagick.command).toBe('magick');
    expect(imageMagick.args).toEqual(
      expect.arrayContaining([
        '-density',
        '220',
        '-resize',
        '3000x',
        '-quality',
        '90',
      ])
    );
  });
});
