const FALLBACK_SITE_URL = 'http://localhost:3000';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanText(value: string | undefined) {
  return String(value || '').trim();
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

export function normalizeArticleEditorLinkUrl(input: string) {
  const value = input.trim();
  if (!value) return '';
  if (/^(https?:\/\/|mailto:|tel:)/i.test(value)) return value;
  return `https://${value}`;
}

export function buildArticleImageFigureHtml(input: {
  src: string;
  alt?: string;
  caption?: string;
  sourceName?: string;
  sourceUrl?: string;
}) {
  const src = normalizeArticleEditorLinkUrl(input.src);
  if (!src) return '';

  const alt = escapeHtml(cleanText(input.alt));
  const caption = escapeHtml(cleanText(input.caption));
  const sourceName = escapeHtml(cleanText(input.sourceName));
  const sourceUrl = normalizeArticleEditorLinkUrl(cleanText(input.sourceUrl));

  const sourceMarkup = sourceName
    ? sourceUrl
      ? ` <span class="article-image-source">Source: <a href="${escapeHtml(
          sourceUrl
        )}" target="_blank" rel="noopener noreferrer">${sourceName}</a></span>`
      : ` <span class="article-image-source">Source: ${sourceName}</span>`
    : '';

  const captionMarkup = caption || sourceMarkup
    ? `<figcaption>${caption || 'Image'}${sourceMarkup}</figcaption>`
    : '';

  return `
<figure class="article-inline-figure">
  <img src="${escapeHtml(src)}" alt="${alt}" loading="lazy" />
  ${captionMarkup}
</figure>`.trim();
}

export function buildArticleResourceCardHtml(input: {
  title: string;
  url?: string;
  description?: string;
}) {
  const title = escapeHtml(cleanText(input.title) || 'Resource');
  const url = normalizeArticleEditorLinkUrl(cleanText(input.url));
  const description = escapeHtml(cleanText(input.description));

  const bodyMarkup = url
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
        url
      )}</a>`
    : '<span>Add your source link or supporting note here.</span>';

  return `
<aside class="article-resource-card">
  <p class="article-resource-card-title">${title}</p>
  <p>${bodyMarkup}</p>
  ${description ? `<p class="article-resource-card-description">${description}</p>` : ''}
</aside>`.trim();
}

export function buildArticleTableHtml(input?: { columns?: number; rows?: number }) {
  const columns = Math.min(6, Math.max(2, Number(input?.columns || 3)));
  const rows = Math.min(8, Math.max(2, Number(input?.rows || 3)));

  const headerRow = Array.from({ length: columns })
    .map((_, index) => `<th>Heading ${index + 1}</th>`)
    .join('');
  const bodyRows = Array.from({ length: rows })
    .map(
      (_, rowIndex) =>
        `<tr>${Array.from({ length: columns })
          .map((__, columnIndex) => `<td>Row ${rowIndex + 1}, Col ${columnIndex + 1}</td>`)
          .join('')}</tr>`
    )
    .join('');

  return `
<div class="article-table-wrap">
  <table>
    <thead>
      <tr>${headerRow}</tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>
</div>`.trim();
}

export function buildArticleQuoteHtml(input: { quote: string; attribution?: string }) {
  const quote = escapeHtml(cleanText(input.quote));
  if (!quote) return '';

  const attribution = escapeHtml(cleanText(input.attribution));
  return `
<blockquote>
  <p>${quote}</p>
  ${attribution ? `<footer>${attribution}</footer>` : ''}
</blockquote>`.trim();
}

export function buildDefaultArticlePermalink(articleId: string, baseUrl?: string) {
  const id = cleanText(articleId);
  if (!id) return '';

  const resolvedBase = trimTrailingSlash(
    cleanText(baseUrl) || trimTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL || '') || FALLBACK_SITE_URL
  );

  return `${resolvedBase}/main/article/${encodeURIComponent(id)}`;
}
