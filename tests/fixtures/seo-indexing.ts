import type { PageInspection, SourceRow } from '../../scripts/audit-seo-indexing';

export const RFC4180_EMBEDDED_NEWLINE_CSV =
  '\uFEFFURL,Last crawled\r\n"https://lokswami.com/main/search?q=first line\r\nsecond line",2026-08-08\r\n"https://lokswami.com/main/search?q=a ""quoted"" value",2026-08-07\r\n';

export function makeSourceRow(overrides: Partial<SourceRow> = {}): SourceRow {
  return {
    rowId: '01-001',
    archive: 'metadata-not-filename.zip',
    csvRow: 2,
    sourceIssue: 'Crawled - currently not indexed',
    rawUrl: 'https://lokswami.com/main/article/example',
    lastCrawled: '2026-08-08',
    normalizedComparisonUrl: 'https://lokswami.com/main/article/example',
    logicalComparisonUrl: 'https://lokswami.com/main/article/example',
    hasWhitespace: false,
    malformedReason: '',
    ...overrides,
  };
}

export function makePageInspection(overrides: Partial<PageInspection> = {}): PageInspection {
  return {
    httpStatus: 200,
    finalUrl: 'https://lokswami.com/main/article/example',
    redirectChain: [],
    redirectLoop: false,
    externalRedirect: false,
    canonical: 'https://lokswami.com/main/article/example',
    canonicals: ['https://lokswami.com/main/article/example'],
    robotsMeta: [],
    xRobotsTag: '',
    noindex: false,
    contentTypeHeader: 'text/html; charset=utf-8',
    fetchError: '',
    standardSitemapMember: false,
    newsSitemapMember: false,
    contentType: 'article',
    publishedPublicStatus: 'public',
    configuredArticleCanonical: null,
    articleResolutionEvidence: 'Public article detail resolved a published article.',
    articleReplacementVerified: false,
    ...overrides,
  };
}
