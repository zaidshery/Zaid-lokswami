'use client';

const PDF_JS_SCRIPT_URL =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
const PDF_JS_WORKER_URL =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

type PdfRenderViewport = {
  width: number;
  height: number;
};

type PdfRenderTask = {
  promise: Promise<void>;
};

type PdfPageProxy = {
  getViewport: (params: { scale: number }) => PdfRenderViewport;
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfRenderViewport;
  }) => PdfRenderTask;
};

type PdfDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  destroy: () => void;
};

type PdfLoadTask = {
  promise: Promise<PdfDocumentProxy>;
};

type PdfJsGlobal = {
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  getDocument: (source: { data: Uint8Array } | { url: string }) => PdfLoadTask;
};

declare global {
  interface Window {
    pdfjsLib?: PdfJsGlobal;
  }
}

let pdfJsLoadPromise: Promise<PdfJsGlobal> | null = null;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildImageName(pdfFileName: string) {
  const trimmed = pdfFileName.trim();
  const withoutExt = trimmed.replace(/\.[^.]+$/, '');
  return `${withoutExt || 'epaper-page-1'}.jpg`;
}

function buildPageImageName(pdfFileName: string, pageNumber: number) {
  const trimmed = pdfFileName.trim();
  const withoutExt = trimmed.replace(/\.[^.]+$/, '');
  return `${withoutExt || 'epaper'}-page-${pageNumber}.jpg`;
}

function loadPdfJsScript(): Promise<PdfJsGlobal> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('PDF conversion is only available in the browser'));
  }

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_JS_WORKER_URL;
    return Promise.resolve(window.pdfjsLib);
  }

  if (!pdfJsLoadPromise) {
    pdfJsLoadPromise = new Promise<PdfJsGlobal>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[data-pdfjs-loader="1"]'
      );

      const onReady = () => {
        if (!window.pdfjsLib) {
          reject(new Error('Failed to initialize PDF renderer'));
          return;
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_JS_WORKER_URL;
        resolve(window.pdfjsLib);
      };

      if (existing) {
        if (window.pdfjsLib) {
          onReady();
          return;
        }
        existing.addEventListener('load', onReady, { once: true });
        existing.addEventListener(
          'error',
          () => reject(new Error('Failed to load PDF renderer')),
          { once: true }
        );
        return;
      }

      const script = document.createElement('script');
      script.src = PDF_JS_SCRIPT_URL;
      script.async = true;
      script.dataset.pdfjsLoader = '1';
      script.onload = onReady;
      script.onerror = () => reject(new Error('Failed to load PDF renderer'));
      document.head.appendChild(script);
    }).catch((error) => {
      pdfJsLoadPromise = null;
      throw error;
    });
  }

  if (!pdfJsLoadPromise) {
    throw new Error('Failed to load PDF renderer');
  }
  return pdfJsLoadPromise;
}

function renderCanvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to convert PDF page into image'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
}

function resolveTargetWidth(options?: { targetWidth?: number }) {
  return Math.max(600, options?.targetWidth ?? 1400);
}

function validatePdfFile(pdfFile: File) {
  if (!pdfFile.type.includes('pdf') && !pdfFile.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Invalid PDF file');
  }
}

async function loadPdfFileDocument(pdfFile: File) {
  validatePdfFile(pdfFile);
  const pdfJs = await loadPdfJsScript();
  const bytes = new Uint8Array(await pdfFile.arrayBuffer());
  return pdfJs.getDocument({ data: bytes }).promise;
}

function safeDestroyPdfDocument(pdfDocument: PdfDocumentProxy) {
  try {
    pdfDocument.destroy();
  } catch {
    // ignore renderer cleanup failures
  }
}

export interface PdfPagePreviewResult {
  dataUrl: string;
  pageCount: number;
  pageNumber: number;
  width: number;
  height: number;
}

export interface RenderedPdfPageImage {
  file: File;
  pageCount: number;
  pageNumber: number;
  width: number;
  height: number;
}

export async function getPdfFilePageCount(pdfFile: File) {
  const pdfDocument = await loadPdfFileDocument(pdfFile);
  try {
    const pageCount = Math.max(1, Number(pdfDocument.numPages) || 1);
    if (pageCount > 1000) {
      throw new Error('PDF has too many pages (maximum 1000).');
    }
    return pageCount;
  } finally {
    safeDestroyPdfDocument(pdfDocument);
  }
}

export async function renderPdfFilePages(
  pdfFile: File,
  options: {
    targetWidth: number;
    jpegQuality?: number;
    onPage: (page: RenderedPdfPageImage) => Promise<void> | void;
  }
) {
  const pdfDocument = await loadPdfFileDocument(pdfFile);

  try {
    const pageCount = Math.max(1, Number(pdfDocument.numPages) || 1);
    if (pageCount > 1000) {
      throw new Error('PDF has too many pages (maximum 1000).');
    }

    const targetWidth = resolveTargetWidth(options);
    const jpegQuality = clamp(options.jpegQuality ?? 0.9, 0.1, 1);

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = targetWidth / Math.max(1, baseViewport.width);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error(`Could not create canvas context for PDF page ${pageNumber}.`);
      }

      try {
        await page.render({ canvasContext: context, viewport }).promise;
        const blob = await renderCanvasToJpegBlob(canvas, jpegQuality);
        await options.onPage({
          file: new File(
            [blob],
            buildPageImageName(pdfFile.name, pageNumber),
            { type: 'image/jpeg', lastModified: pdfFile.lastModified }
          ),
          pageCount,
          pageNumber,
          width: canvas.width,
          height: canvas.height,
        });
      } finally {
        canvas.width = 1;
        canvas.height = 1;
      }
    }

    return { pageCount };
  } finally {
    safeDestroyPdfDocument(pdfDocument);
  }
}

export async function convertPdfFileToThumbnailImage(
  pdfFile: File,
  options?: { targetWidth?: number; jpegQuality?: number }
) {
  const pdfDocument = await loadPdfFileDocument(pdfFile);

  try {
    const page = await pdfDocument.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const targetWidth = resolveTargetWidth(options);
    const scale = targetWidth / Math.max(1, baseViewport.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not create canvas context');
    }

    await page.render({ canvasContext: context, viewport }).promise;
    const blob = await renderCanvasToJpegBlob(canvas, options?.jpegQuality ?? 0.9);
    return new File([blob], buildImageName(pdfFile.name), { type: 'image/jpeg' });
  } finally {
    safeDestroyPdfDocument(pdfDocument);
  }
}

export async function renderPdfPagePreviewFromUrl(
  pdfUrl: string,
  options?: { page?: number; targetWidth?: number; jpegQuality?: number }
): Promise<PdfPagePreviewResult> {
  const source = pdfUrl.trim();
  if (!source) {
    throw new Error('PDF URL is required');
  }

  const pdfJs = await loadPdfJsScript();
  let documentSource: { data: Uint8Array } | { url: string };

  if (source.toLowerCase().startsWith('data:')) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error('Failed to read PDF data');
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    documentSource = { data: bytes };
  } else {
    documentSource = { url: source };
  }

  const pdfDocument = await pdfJs.getDocument(documentSource).promise;

  try {
    const pageCount = Math.max(1, Number(pdfDocument.numPages) || 1);
    const pageNumber = clamp(Math.round(options?.page ?? 1), 1, pageCount);
    const page = await pdfDocument.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const targetWidth = resolveTargetWidth(options);
    const scale = targetWidth / Math.max(1, baseViewport.width);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not create canvas context');
    }

    await page.render({ canvasContext: context, viewport }).promise;

    return {
      dataUrl: canvas.toDataURL('image/jpeg', options?.jpegQuality ?? 0.9),
      pageCount,
      pageNumber,
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    safeDestroyPdfDocument(pdfDocument);
  }
}

export async function convertPdfUrlToThumbnailImage(
  pdfUrl: string,
  options?: { targetWidth?: number; jpegQuality?: number }
) {
  const source = pdfUrl.trim();
  if (!source) {
    throw new Error('PDF URL is required');
  }

  const response = await fetch(source);
  if (!response.ok) {
    throw new Error('Failed to download PDF');
  }

  const blob = await response.blob();
  const file = new File([blob], 'epaper.pdf', { type: 'application/pdf' });
  return convertPdfFileToThumbnailImage(file, options);
}
