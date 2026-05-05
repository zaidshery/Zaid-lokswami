import { describe, expect, it } from 'vitest';
import {
  buildEpaperImageAutomationUpdates,
  hasCompletePageImages,
} from '@/lib/server/epaperImageAutomation';
import { buildEpaperReadiness } from '@/lib/utils/epaperAdminReadiness';

describe('e-paper image automation', () => {
  it('detects when all expected pages have images', () => {
    expect(
      hasCompletePageImages({
        pageCount: 2,
        pages: [
          { pageNumber: 1, imagePath: '/page-1.jpg' },
          { pageNumber: 2, imagePath: '/page-2.jpg' },
        ],
      })
    ).toBe(true);

    expect(
      hasCompletePageImages({
        pageCount: 2,
        pages: [
          { pageNumber: 1, imagePath: '/page-1.jpg' },
          { pageNumber: 2, imagePath: '' },
        ],
      })
    ).toBe(false);
  });

  it('sets cover from page one and advances draft uploads to pages ready', () => {
    expect(
      buildEpaperImageAutomationUpdates({
        pageCount: 2,
        currentThumbnailPath: '/placeholders/epaper.svg',
        currentProductionStatus: 'draft_upload',
        currentStatus: 'draft',
        pages: [
          { pageNumber: 1, imagePath: '/page-1.jpg' },
          { pageNumber: 2, imagePath: '/page-2.jpg' },
        ],
      })
    ).toEqual({
      thumbnailPath: '/page-1.jpg',
      thumbnail: '/page-1.jpg',
      productionStatus: 'pages_ready',
    });
  });

  it('replaces direct uploaded thumbnails with page one after pages are uploaded', () => {
    expect(
      buildEpaperImageAutomationUpdates({
        pageCount: 1,
        currentThumbnailPath:
          'https://lokswami-storage-2026.sgp1.cdn.digitaloceanspaces.com/lokswami/epapers/indore/2026-05-05/thumbnail/cover.jpg',
        currentProductionStatus: 'draft_upload',
        currentStatus: 'draft',
        pages: [{ pageNumber: 1, imagePath: 'https://cdn.example.com/page-1.jpg' }],
      })
    ).toEqual({
      thumbnailPath: 'https://cdn.example.com/page-1.jpg',
      thumbnail: 'https://cdn.example.com/page-1.jpg',
      productionStatus: 'pages_ready',
    });
  });

  it('does not overwrite custom cover or skip ahead from later workflow stages', () => {
    expect(
      buildEpaperImageAutomationUpdates({
        pageCount: 1,
        currentThumbnailPath: '/custom-cover.jpg',
        currentProductionStatus: 'ocr_review',
        currentStatus: 'draft',
        pages: [{ pageNumber: 1, imagePath: '/page-1.jpg' }],
      })
    ).toEqual({});
  });
});

describe('e-paper readiness automation inputs', () => {
  it('marks mapped readable pages ready for QA automation checks', () => {
    const readiness = buildEpaperReadiness({
      epaper: {
        _id: 'paper-1',
        cityName: 'Indore',
        citySlug: 'indore',
        pageCount: 1,
        pdfPath: '/uploads/paper.pdf',
        thumbnailPath: '/page-1.jpg',
        pages: [{ pageNumber: 1, imagePath: '/page-1.jpg' }],
      },
      articles: [
        {
          pageNumber: 1,
          contentHtml: '<p>Readable story text</p>',
          excerpt: '',
          coverImagePath: '',
        },
      ],
    });

    expect(readiness.pagesMissingImage).toBe(0);
    expect(readiness.pagesMissingHotspots).toBe(0);
    expect(readiness.articlesMissingReadableText).toBe(0);
  });
});
