import 'server-only';

import sharp from 'sharp';
import { EPAPER_PDF_MAX_BYTES } from '@/lib/utils/epaperStorage';

const PDF_SIGNATURE = Buffer.from('%PDF-');
const TARGET_WIDTH = 3000;
const JPEG_QUALITY = 90;

function copyPdfBytes(buffer: Buffer) {
  return Uint8Array.from(buffer);
}

function hasPdfSignature(buffer: Buffer) {
  return (
    buffer.length >= PDF_SIGNATURE.length &&
    buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)
  );
}

export async function downloadVerifiedEpaperPdf(pdfUrl: string) {
  const parsed = new URL(pdfUrl);
  const isSpacesAsset =
    parsed.protocol === 'https:' &&
    (parsed.hostname.endsWith('.digitaloceanspaces.com') ||
      parsed.hostname.endsWith('.cdn.digitaloceanspaces.com')) &&
    parsed.pathname.includes('/lokswami/epapers/');

  if (!isSpacesAsset) {
    throw new Error('Only verified DigitalOcean Spaces e-paper PDFs can be processed.');
  }

  const response = await fetch(parsed, {
    cache: 'no-store',
    redirect: 'error',
  });
  if (!response.ok) {
    throw new Error(`PDF download failed (${response.status}).`);
  }

  const declaredSize = Number(response.headers.get('content-length') || 0);
  if (declaredSize > EPAPER_PDF_MAX_BYTES) {
    throw new Error('PDF exceeds the 25MB processing limit.');
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > EPAPER_PDF_MAX_BYTES) {
    throw new Error('PDF is empty or exceeds the 25MB processing limit.');
  }
  if (!hasPdfSignature(buffer)) {
    throw new Error('PDF signature is invalid.');
  }

  return buffer;
}

async function installPdfCanvasGlobals() {
  const canvasModule = await import('@napi-rs/canvas');
  const globalScope = globalThis as unknown as Record<string, unknown>;
  globalScope.DOMMatrix ||= canvasModule.DOMMatrix;
  globalScope.ImageData ||= canvasModule.ImageData;
  globalScope.Path2D ||= canvasModule.Path2D;
  return canvasModule;
}

export async function getPdfPageCountFromBuffer(pdfBuffer: Buffer) {
  await installPdfCanvasGlobals();
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({
    data: copyPdfBytes(pdfBuffer),
    useSystemFonts: true,
  }).promise;
  const pageCount = document.numPages;
  await document.destroy();
  return pageCount;
}

export async function renderPdfPageToJpeg(input: {
  pdfBuffer: Buffer;
  pageNumber: number;
}) {
  const canvasModule = await installPdfCanvasGlobals();
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({
    data: copyPdfBytes(input.pdfBuffer),
    useSystemFonts: true,
  }).promise;

  try {
    if (input.pageNumber < 1 || input.pageNumber > document.numPages) {
      throw new Error(`PDF page ${input.pageNumber} does not exist.`);
    }

    const page = await document.getPage(input.pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = TARGET_WIDTH / baseViewport.width;
    const viewport = page.getViewport({ scale });
    const width = Math.round(viewport.width);
    const height = Math.round(viewport.height);
    const canvas = canvasModule.createCanvas(width, height);
    const context = canvas.getContext('2d');

    await page.render({
      canvasContext: context as never,
      viewport,
      background: '#ffffff',
    }).promise;

    const normalized = await sharp(canvas.toBuffer('image/jpeg', JPEG_QUALITY))
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();

    return { buffer: normalized, width, height };
  } finally {
    await document.destroy();
  }
}
