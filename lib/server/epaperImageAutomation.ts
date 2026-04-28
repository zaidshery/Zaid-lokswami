import 'server-only';

import type { EPaperProductionStatus } from '@/lib/workflow/types';

type PageLike = {
  pageNumber: number;
  imagePath?: string;
};

function firstPageImage(pages: PageLike[]) {
  return String(pages.find((page) => page.pageNumber === 1)?.imagePath || '').trim();
}

function isPlaceholderThumbnail(value: unknown) {
  const thumbnail = String(value || '').trim();
  return !thumbnail || thumbnail.includes('/placeholders/');
}

export function hasCompletePageImages(input: { pageCount: number; pages: PageLike[] }) {
  const pageCount = Math.max(1, Math.floor(Number(input.pageCount || 0)));
  const imagePages = new Set(
    input.pages
      .filter((page) => page.pageNumber >= 1 && page.pageNumber <= pageCount)
      .filter((page) => String(page.imagePath || '').trim())
      .map((page) => page.pageNumber)
  );

  return imagePages.size >= pageCount;
}

export function buildEpaperImageAutomationUpdates(input: {
  pageCount: number;
  pages: PageLike[];
  currentThumbnailPath?: unknown;
  currentProductionStatus?: unknown;
  currentStatus?: unknown;
}) {
  const updates: {
    thumbnailPath?: string;
    thumbnail?: string;
    productionStatus?: EPaperProductionStatus;
  } = {};

  const coverImagePath = firstPageImage(input.pages);
  if (coverImagePath && isPlaceholderThumbnail(input.currentThumbnailPath)) {
    updates.thumbnailPath = coverImagePath;
    updates.thumbnail = coverImagePath;
  }

  const productionStatus = String(input.currentProductionStatus || 'draft_upload');
  const isPublished = input.currentStatus === 'published' || productionStatus === 'published';
  if (
    !isPublished &&
    productionStatus === 'draft_upload' &&
    hasCompletePageImages({ pageCount: input.pageCount, pages: input.pages })
  ) {
    updates.productionStatus = 'pages_ready';
  }

  return updates;
}
