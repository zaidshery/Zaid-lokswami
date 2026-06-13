import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getPdfFilePageCount,
  renderPdfFilePages,
} from '@/lib/utils/pdfThumbnailClient';

function installPdfRendererMock() {
  const destroy = vi.fn();
  const render = vi.fn(() => ({ promise: Promise.resolve() }));
  const getPage = vi.fn(async () => ({
    getViewport: ({ scale }: { scale: number }) => ({
      width: 600 * scale,
      height: 900 * scale,
    }),
    render,
  }));
  const getDocument = vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 2,
      getPage,
      destroy,
    }),
  }));

  window.pdfjsLib = {
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument,
  };

  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({})),
    toBlob: vi.fn((callback: (blob: Blob | null) => void) => {
      callback(new Blob(['page'], { type: 'image/jpeg' }));
    }),
  };
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    if (tagName.toLowerCase() === 'canvas') {
      return canvas as unknown as HTMLCanvasElement;
    }
    return originalCreateElement(tagName);
  });

  return { canvas, destroy, getDocument, getPage, render };
}

afterEach(() => {
  delete window.pdfjsLib;
  vi.restoreAllMocks();
});

describe('e-paper PDF client conversion', () => {
  it('reads the page count and renders each page at 3000px JPEG quality 90', async () => {
    const { canvas, destroy, getDocument, getPage, render } =
      installPdfRendererMock();
    const pdf = new File(['pdf'], 'indore-edition.pdf', {
      type: 'application/pdf',
      lastModified: 123,
    });

    await expect(getPdfFilePageCount(pdf)).resolves.toBe(2);

    const pages: Array<{
      name: string;
      type: string;
      pageNumber: number;
      width: number;
      height: number;
    }> = [];
    const result = await renderPdfFilePages(pdf, {
      targetWidth: 3000,
      jpegQuality: 0.9,
      onPage: (page) => {
        pages.push({
          name: page.file.name,
          type: page.file.type,
          pageNumber: page.pageNumber,
          width: page.width,
          height: page.height,
        });
      },
    });

    expect(result.pageCount).toBe(2);
    expect(pages).toEqual([
      {
        name: 'indore-edition-page-1.jpg',
        type: 'image/jpeg',
        pageNumber: 1,
        width: 3000,
        height: 4500,
      },
      {
        name: 'indore-edition-page-2.jpg',
        type: 'image/jpeg',
        pageNumber: 2,
        width: 3000,
        height: 4500,
      },
    ]);
    expect(getDocument).toHaveBeenCalledTimes(2);
    expect(getPage).toHaveBeenCalledTimes(2);
    expect(render).toHaveBeenCalledTimes(2);
    expect(canvas.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/jpeg',
      0.9
    );
    expect(destroy).toHaveBeenCalledTimes(2);
  });
});
