type EpaperCoverPageLike = {
  pageNumber?: unknown;
  imagePath?: unknown;
};

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

export function getFirstEpaperPageImagePath(pages: unknown) {
  if (!Array.isArray(pages)) return '';

  const sortedPages = pages
    .map((page) => (typeof page === 'object' && page !== null ? (page as EpaperCoverPageLike) : null))
    .filter((page): page is EpaperCoverPageLike => Boolean(page))
    .sort((left, right) => Number(left.pageNumber || 0) - Number(right.pageNumber || 0));

  return firstNonEmptyString(
    sortedPages.find((page) => Number(page.pageNumber || 0) === 1)?.imagePath,
    sortedPages.find((page) => firstNonEmptyString(page.imagePath))?.imagePath
  );
}

export function resolveEpaperCoverImagePath(input: {
  thumbnailPath?: unknown;
  thumbnail?: unknown;
  pages?: unknown;
}) {
  return firstNonEmptyString(
    getFirstEpaperPageImagePath(input.pages),
    input.thumbnailPath,
    input.thumbnail
  );
}

export function isDirectEpaperThumbnailPath(value: unknown) {
  const normalized = String(value || '').trim().replace(/\\/g, '/');
  return /\/lokswami\/epapers\/[^/]+\/\d{4}-\d{2}-\d{2}\/thumbnail\//i.test(normalized);
}
