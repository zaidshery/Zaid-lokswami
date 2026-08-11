import { vi } from 'vitest';
import {
  analyzeRawUrl,
  calculateCrc32,
  classifyRecord,
  extractHtmlSeo,
  fetchRedirectChain,
  fetchSitemap,
  normalizeComparisonUrl,
  normalizeLogicalUrl,
  parseCsv,
  parseGscArchive,
  readZipEntries,
  recordsToCsv,
  resolvePublicArticle,
} from '../scripts/audit-seo-indexing';
import {
  makePageInspection,
  makeSourceRow,
  RFC4180_EMBEDDED_NEWLINE_CSV,
} from './fixtures/seo-indexing';

function buildStoredZip(files: Record<string, string> | Array<[string, string]>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  const entries = Array.isArray(files) ? files : Object.entries(files);
  for (const [name, text] of entries) {
    const nameBuffer = Buffer.from(name, 'utf8');
    const data = Buffer.from(text, 'utf8');
    const crc = calculateCrc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    localParts.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, nameBuffer);
    localOffset += local.length + nameBuffer.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

function response(body: string, url: string, status = 200, headers: Record<string, string> = {}) {
  return {
    status,
    url,
    headers: new Headers(headers),
    text: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('GSC input parsing', () => {
  it('parses RFC 4180 quoted newlines and escaped quotes without splitting rows', () => {
    expect(parseCsv(RFC4180_EMBEDDED_NEWLINE_CSV)).toEqual([
      ['URL', 'Last crawled'],
      ['https://lokswami.com/main/search?q=first line\r\nsecond line', '2026-08-08'],
      ['https://lokswami.com/main/search?q=a "quoted" value', '2026-08-07'],
    ]);
  });

  it('rejects malformed quoted CSV fields', () => {
    expect(() => parseCsv('URL,Last crawled\r\n"unterminated,2026-08-08')).toThrow(
      /unterminated quoted field/i
    );
  });

  it('validates ZIP CRCs and associates an issue from Metadata.csv rather than the filename', () => {
    const archive = buildStoredZip({
      'Chart.csv': 'Date,Affected pages\r\n2026-08-08,1\r\n',
      'Table.csv': 'URL,Last crawled\r\nhttps://lokswami.com/main/example,2026-08-08\r\n',
      'Metadata.csv':
        'Property,Value\r\nSitemap,All known pages\r\nIssue,Not found (404)\r\n',
    });
    expect(readZipEntries(archive).map((entry) => entry.name)).toEqual([
      'Chart.csv',
      'Table.csv',
      'Metadata.csv',
    ]);
    const parsed = parseGscArchive(archive, 'misleading-name.zip', 'https://lokswami.com');
    expect(parsed.inventory).toMatchObject({ kind: 'issue', issue: 'Not found (404)' });
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      sourceIssue: 'Not found (404)',
      archive: 'misleading-name.zip',
      csvRow: 2,
    });
  });

  it('rejects a ZIP entry whose CRC does not match', () => {
    const archive = buildStoredZip({ 'Table.csv': 'URL\r\nhttps://lokswami.com/main\r\n' });
    archive[40] ^= 0xff;
    expect(() => readZipEntries(archive)).toThrow(/CRC mismatch/i);
  });

  it('rejects duplicate ZIP entry names instead of silently taking the last copy', () => {
    const archive = buildStoredZip([
      ['Table.csv', 'URL,Last crawled\r\n'],
      ['Table.csv', 'URL,Last crawled\r\nhttps://lokswami.com/main,2026-08-08\r\n'],
    ]);
    expect(() => readZipEntries(archive)).toThrow(/duplicate ZIP entry/i);
  });

  it('rejects a ZIP entry whose declared uncompressed size exceeds the audit limit', () => {
    const archive = buildStoredZip({ 'Table.csv': 'x'.repeat(5 * 1024 * 1024 + 1) });
    expect(() => readZipEntries(archive)).toThrow(/ZIP entry.*size limit/i);
  });

  it('rejects ZIP-slip paths even though the audit never extracts entries', () => {
    const archive = buildStoredZip({ '../Table.csv': 'URL,Last crawled\r\n' });
    expect(() => readZipEntries(archive)).toThrow(/unsafe path/i);
  });

  it('rejects archives with more entries than the fixed native-export bound', () => {
    const files = Array.from({ length: 21 }, (_, index) => [`${index}.csv`, 'x\r\n'] as [string, string]);
    expect(() => readZipEntries(buildStoredZip(files))).toThrow(/entry limit/i);
  });

  it('rejects unexpected files in a native issue archive', () => {
    const archive = buildStoredZip({
      'Chart.csv': 'Date,Affected pages\r\n2026-08-08,1\r\n',
      'Table.csv': 'URL,Last crawled\r\nhttps://lokswami.com/main/example,2026-08-08\r\n',
      'Metadata.csv': 'Property,Value\r\nSitemap,All known pages\r\nIssue,Not found (404)\r\n',
      'unexpected.csv': 'unsafe\r\n',
    });
    expect(() => parseGscArchive(archive, 'unexpected.zip', 'https://lokswami.com')).toThrow(
      /unexpected ZIP entries/i
    );
  });
});

describe('URL normalization and SEO extraction', () => {
  it('normalizes fragments, default ports, and trailing slashes while preserving queries', () => {
    expect(
      normalizeComparisonUrl('https://lokswami.com:443/main/epaper/?city=indore#page')
    ).toBe('https://lokswami.com/main/epaper?city=indore');
  });

  it('detects query-order equivalents without rewriting the traceable comparison URL', () => {
    const left = 'https://lokswami.com/main/epaper?city=indore&date=2026-06-01&page=4';
    const right = 'https://lokswami.com/main/epaper?page=4&date=2026-06-01&city=indore';
    expect(normalizeComparisonUrl(left)).not.toBe(normalizeComparisonUrl(right));
    expect(normalizeLogicalUrl(left)).toBe(normalizeLogicalUrl(right));
  });

  it('preserves and flags whitespace-containing raw URLs instead of repairing them', () => {
    expect(analyzeRawUrl('https://lokswami.com/main/search?q=first\nsecond', 'https://lokswami.com')).toEqual({
      normalizedComparisonUrl: null,
      logicalComparisonUrl: null,
      hasWhitespace: true,
      malformedReason: 'Raw URL contains whitespace and is preserved without repair.',
    });
  });

  it('extracts conflicting canonicals and robots directives for safety checks', () => {
    const result = extractHtmlSeo(
      '<link rel="canonical" href="/main/one?paper=1&amp;page=2"><link href="/main/two" rel="canonical"><meta name="robots" content="noindex,follow">',
      'https://lokswami.com/main/source'
    );
    expect(result.canonicals).toEqual([
      'https://lokswami.com/main/one?paper=1&page=2',
      'https://lokswami.com/main/two',
    ]);
    expect(result.robotsMeta).toEqual(['robots:noindex,follow']);
  });
});

describe('read-only classification safety', () => {
  it('never guesses a replacement for a current 404', () => {
    const result = classifyRecord(
      makeSourceRow({ sourceIssue: 'Not found (404)' }),
      makePageInspection({ httpStatus: 404, canonical: null, canonicals: [], publishedPublicStatus: 'not_public' })
    );
    expect(result).toMatchObject({
      proposedAction: 'INVESTIGATE_CONTENT',
      proposedTarget: null,
      confidence: 'low',
    });
    expect(result.manualReviewReason).toMatch(/do not guess/i);
  });

  it('proposes a self-canonical only for a clean non-search 200 page with no canonical', () => {
    const result = classifyRecord(
      makeSourceRow({ sourceIssue: 'Duplicate without user-selected canonical' }),
      makePageInspection({ canonical: null, canonicals: [], contentType: 'reader-static' })
    );
    expect(result).toMatchObject({
      proposedAction: 'SELF_CANONICAL',
      proposedTarget: 'https://lokswami.com/main/article/example',
    });
  });

  it('sends search duplicates and external canonicals to manual review', () => {
    const search = classifyRecord(
      makeSourceRow({ sourceIssue: 'Duplicate without user-selected canonical' }),
      makePageInspection({ contentType: 'search' })
    );
    expect(search.proposedAction).toBe('MANUAL_REVIEW');

    const external = classifyRecord(
      makeSourceRow(),
      makePageInspection({
        canonical: 'https://example.com/article',
        canonicals: ['https://example.com/article'],
      })
    );
    expect(external).toMatchObject({
      proposedAction: 'MANUAL_REVIEW',
      manualReviewReason: 'Canonical points to an external origin.',
    });

    const malformed = classifyRecord(
      makeSourceRow(),
      makePageInspection({ canonical: 'https://[invalid', canonicals: ['https://[invalid'] })
    );
    expect(malformed).toMatchObject({
      proposedAction: 'MANUAL_REVIEW',
      manualReviewReason: 'Canonical URL is malformed.',
    });
  });

  it('keeps protective noindex for an article proven not public', () => {
    const result = classifyRecord(
      makeSourceRow({ sourceIssue: 'Excluded by ‘noindex’ tag' }),
      makePageInspection({
        noindex: true,
        robotsMeta: ['robots:noindex,follow'],
        publishedPublicStatus: 'not_public',
      })
    );
    expect(result.proposedAction).toBe('INTENTIONAL_NOINDEX');
  });

  it('prioritizes sitemap safety when a member is noindex or unpublished', () => {
    const result = classifyRecord(
      makeSourceRow({ sourceIssue: 'Excluded by ‘noindex’ tag' }),
      makePageInspection({
        noindex: true,
        standardSitemapMember: true,
        publishedPublicStatus: 'not_public',
      })
    );
    expect(result).toMatchObject({ proposedAction: 'REMOVE_FROM_SITEMAP', confidence: 'high' });
  });

  it('uses only the observed final URL as a redirect proposal', () => {
    const finalUrl = 'https://lokswami.com/main/article/current';
    const result = classifyRecord(
      makeSourceRow({ sourceIssue: 'Page with redirect' }),
      makePageInspection({
        finalUrl,
        articleReplacementVerified: true,
        redirectChain: [
          {
            url: 'https://lokswami.com/main/article/old',
            status: 308,
            location: finalUrl,
          },
        ],
      })
    );
    expect(result).toMatchObject({
      proposedAction: 'REDIRECT_TO_REPLACEMENT',
      proposedTarget: finalUrl,
      confidence: 'high',
    });
  });

  it('does not propose an article replacement without verified id or slug-history evidence', () => {
    const finalUrl = 'https://lokswami.com/main/article/current';
    const result = classifyRecord(
      makeSourceRow({ rawUrl: 'https://lokswami.com/main/article/old' }),
      makePageInspection({
        finalUrl,
        articleResolutionEvidence: 'Public article detail could not verify the original token.',
        redirectChain: [
          { url: 'https://lokswami.com/main/article/old', status: 308, location: finalUrl },
        ],
      })
    );
    expect(result).toMatchObject({ proposedAction: 'MANUAL_REVIEW', proposedTarget: null });
  });

  it('keeps the known private saved-route sign-in redirect out of replacement proposals', () => {
    const result = classifyRecord(
      makeSourceRow({
        sourceIssue: 'Crawled - currently not indexed',
        rawUrl: 'https://lokswami.com/main/saved',
        normalizedComparisonUrl: 'https://lokswami.com/main/saved',
        logicalComparisonUrl: 'https://lokswami.com/main/saved',
      }),
      makePageInspection({
        contentType: 'saved',
        finalUrl: 'https://lokswami.com/signin?redirect=%2Fmain%2Fsaved',
        redirectChain: [
          {
            url: 'https://lokswami.com/main/saved',
            status: 307,
            location: 'https://lokswami.com/signin?redirect=%2Fmain%2Fsaved',
          },
        ],
      })
    );
    expect(result).toMatchObject({
      proposedAction: 'INTENTIONAL_NOINDEX',
      proposedTarget: null,
      confidence: 'high',
    });
  });
});

describe('read-only redirect inspection', () => {
  it('captures a redirect chain and final GET response', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          response('', 'https://lokswami.com/old', 308, { location: '/main/current' })
        )
        .mockResolvedValueOnce(response('<html>current</html>', 'https://lokswami.com/main/current'))
    );
    await expect(
      fetchRedirectChain('https://lokswami.com/old', 'https://lokswami.com', 1000, 5)
    ).resolves.toMatchObject({
      status: 200,
      finalUrl: 'https://lokswami.com/main/current',
      redirectLoop: false,
      externalRedirect: false,
      redirectChain: [
        {
          url: 'https://lokswami.com/old',
          status: 308,
          location: 'https://lokswami.com/main/current',
        },
      ],
    });
  });

  it('detects loops without bypassing the configured redirect limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(response('', 'https://lokswami.com/a', 302, { location: '/b' }))
        .mockResolvedValueOnce(response('', 'https://lokswami.com/b', 302, { location: '/a' }))
    );
    await expect(
      fetchRedirectChain('https://lokswami.com/a', 'https://lokswami.com', 1000, 5)
    ).resolves.toMatchObject({ redirectLoop: true });
  });

  it('stops before fetching an external redirect destination', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response('', 'https://lokswami.com/old', 302, { location: 'https://example.com/target' })
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      fetchRedirectChain('https://lokswami.com/old', 'https://lokswami.com', 1000, 5)
    ).resolves.toMatchObject({ externalRedirect: true, finalUrl: 'https://example.com/target' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET', redirect: 'manual' });
  });

  it('does not follow a sitemap redirect to an external origin', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response('', 'https://lokswami.com/sitemap.xml', 302, {
        location: 'https://example.com/private.xml',
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchSitemap('https://lokswami.com', '/sitemap.xml', 1000)).rejects.toThrow(
      /external redirect/i
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('verifies an article replacement from the original published API token and returned slug', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response(
        JSON.stringify({
          data: {
            id: 'article-id',
            slug: 'current',
            previousSlugs: ['old'],
            seo: { canonicalUrl: '' },
          },
        }),
        'https://lokswami.com/api/v1/public/articles/old',
        200,
        { 'content-type': 'application/json' }
      )
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      resolvePublicArticle(
        'old',
        'https://lokswami.com',
        1000,
        'https://lokswami.com/main/article/current',
        5
      )
    ).resolves.toMatchObject({
      publishedPublicStatus: 'public',
      articleReplacementVerified: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://lokswami.com/api/v1/public/articles/old');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET', redirect: 'manual' });
  });

  it('does not follow a public-article API redirect to an external origin', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response('', 'https://lokswami.com/api/v1/public/articles/old', 302, {
        location: 'https://example.com/article.json',
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      resolvePublicArticle(
        'old',
        'https://lokswami.com',
        1000,
        'https://lokswami.com/main/article/current',
        5
      )
    ).resolves.toMatchObject({
      publishedPublicStatus: 'unknown',
      articleReplacementVerified: false,
      articleResolutionEvidence: expect.stringMatching(/external redirect/i),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the timeout active while the response body is stalled', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        signal = init?.signal || null;
        return {
          status: 200,
          url: 'https://lokswami.com/main',
          headers: new Headers({ 'content-type': 'text/html' }),
          text: () =>
            new Promise<string>((_resolve, reject) => {
              signal?.addEventListener(
                'abort',
                () => reject(new DOMException('aborted', 'AbortError')),
                { once: true }
              );
            }),
        } as Response;
      })
    );
    const request = fetchRedirectChain(
      'https://lokswami.com/main',
      'https://lokswami.com',
      50,
      1
    );
    const assertion = expect(request).rejects.toThrow(/timed out after 50ms.*headers or body/i);
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('generated CSV safety', () => {
  it('neutralizes spreadsheet formulas without changing the source JSON value', () => {
    const source = makeSourceRow({ archive: '=HYPERLINK("https://example.com")' });
    const page = makePageInspection();
    const classification = classifyRecord(source, page);
    const record = {
      ...source,
      ...page,
      ...classification,
      processingError: null,
      logicalDuplicateRowIds: [],
      unrelatedManyToOneRedirect: false,
      detections: [],
    };
    expect(record.archive).toBe('=HYPERLINK("https://example.com")');
    expect(recordsToCsv([record])).toContain("'=HYPERLINK");
  });
});
