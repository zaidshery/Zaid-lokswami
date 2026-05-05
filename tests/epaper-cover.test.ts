import { describe, expect, it } from 'vitest';
import {
  getFirstEpaperPageImagePath,
  isDirectEpaperThumbnailPath,
  resolveEpaperCoverImagePath,
} from '@/lib/utils/epaperCover';

describe('e-paper cover selection', () => {
  it('uses page one as the visible cover when page images exist', () => {
    const pages = [
      { pageNumber: 2, imagePath: 'https://cdn.example.com/page-2.jpg' },
      { pageNumber: 1, imagePath: 'https://cdn.example.com/page-1.jpg' },
    ];

    expect(getFirstEpaperPageImagePath(pages)).toBe('https://cdn.example.com/page-1.jpg');
    expect(
      resolveEpaperCoverImagePath({
        thumbnailPath: 'https://cdn.example.com/broken-thumbnail.jpg',
        pages,
      })
    ).toBe('https://cdn.example.com/page-1.jpg');
  });

  it('falls back to the saved thumbnail when no page image exists yet', () => {
    expect(
      resolveEpaperCoverImagePath({
        thumbnailPath: 'https://cdn.example.com/thumbnail.jpg',
        pages: [],
      })
    ).toBe('https://cdn.example.com/thumbnail.jpg');
  });

  it('detects direct Spaces thumbnail objects that can be replaced by page one', () => {
    expect(
      isDirectEpaperThumbnailPath(
        'https://lokswami-storage-2026.sgp1.cdn.digitaloceanspaces.com/lokswami/epapers/indore/2026-05-05/thumbnail/cover.jpg'
      )
    ).toBe(true);

    expect(isDirectEpaperThumbnailPath('https://cdn.example.com/custom-cover.jpg')).toBe(false);
  });
});
