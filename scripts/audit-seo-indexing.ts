import { createHash } from 'node:crypto';
import { readFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';

export const GSC_ISSUES = [
  'Alternate page with proper canonical tag',
  'Not found (404)',
  'Duplicate without user-selected canonical',
  'Excluded by ‘noindex’ tag',
  'Page with redirect',
  'Crawled - currently not indexed',
] as const;

export const PROPOSED_ACTIONS = [
  'KEEP',
  'SELF_CANONICAL',
  'REDIRECT_TO_REPLACEMENT',
  'INTENTIONAL_NOINDEX',
  'REMOVE_FROM_SITEMAP',
  'INVESTIGATE_CONTENT',
  'MANUAL_REVIEW',
] as const;

export type GscIssue = (typeof GSC_ISSUES)[number];
export type ProposedAction = (typeof PROPOSED_ACTIONS)[number];
export type Confidence = 'high' | 'medium' | 'low';

type CsvRow = string[];

export type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedBytes: number;
  uncompressedBytes: number;
  crc32: string;
  data: Buffer;
};

export type SourceRow = {
  rowId: string;
  archive: string;
  csvRow: number;
  sourceIssue: GscIssue;
  rawUrl: string;
  lastCrawled: string;
  normalizedComparisonUrl: string | null;
  logicalComparisonUrl: string | null;
  hasWhitespace: boolean;
  malformedReason: string;
};

export type RedirectHop = {
  url: string;
  status: number;
  location: string;
};

export type PageInspection = {
  httpStatus: number | null;
  finalUrl: string | null;
  redirectChain: RedirectHop[];
  redirectLoop: boolean;
  externalRedirect: boolean;
  canonical: string | null;
  canonicals: string[];
  robotsMeta: string[];
  xRobotsTag: string;
  noindex: boolean;
  contentTypeHeader: string;
  fetchError: string;
  standardSitemapMember: boolean;
  newsSitemapMember: boolean;
  contentType: string;
  publishedPublicStatus: 'public' | 'not_public' | 'unknown' | 'not_applicable';
  configuredArticleCanonical: string | null;
  articleResolutionEvidence: string;
  articleReplacementVerified: boolean;
};

export type Classification = {
  proposedAction: ProposedAction;
  proposedTarget: string | null;
  confidence: Confidence;
  evidence: string[];
  manualReviewReason: string | null;
};

export type AuditRecord = SourceRow &
  PageInspection &
  Classification & {
    processingError: string | null;
    logicalDuplicateRowIds: string[];
    unrelatedManyToOneRedirect: boolean;
    detections: string[];
  };

export type ArchiveInventory = {
  fileName: string;
  bytes: number;
  sha256: string;
  validZip: boolean;
  entries: Array<{
    name: string;
    rows: number;
    header: string[];
    bytes: number;
    compressedBytes: number;
    crc32: string;
  }>;
  kind: 'issue' | 'coverage';
  issue?: GscIssue;
  chart?: {
    from: string;
    to: string;
    rows: number;
    latestAffectedPages?: number;
  };
};

export type CoverageSummary = {
  latestDate: string;
  indexed: number;
  notIndexed: number;
  totalKnown: number;
  issues: Array<{ reason: string; source: string; validation: string; pages: number }>;
};

export type ParsedGscArchive = {
  inventory: ArchiveInventory;
  rows: SourceRow[];
  coverage: CoverageSummary | null;
};

export type IssueReconciliation = {
  issue: GscIssue;
  archive: string;
  archiveRows: number;
  coveragePages: number;
  archiveLatestDate: string;
  coverageLatestDate: string;
};

type AuditOptions = {
  baseUrl: string;
  zipPaths: string[];
  outputDir: string;
  timeoutMs: number;
  concurrency: number;
  maxRedirects: number;
};

const EXPECTED_TABLE_HEADER = ['URL', 'Last crawled'];
const EXPECTED_ISSUE_CHART_HEADER = ['Date', 'Affected pages'];
const EXPECTED_COVERAGE_CHART_HEADER = ['Date', 'Not indexed', 'Indexed', 'Impressions'];
const EXPECTED_METADATA_HEADER = ['Property', 'Value'];
const EXPECTED_COVERAGE_ISSUES_HEADER = ['Reason', 'Source', 'Validation', 'Pages'];
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_ZIP_ARCHIVE_BYTES = 10 * 1024 * 1024;
const MAX_ZIP_ENTRY_BYTES = 5 * 1024 * 1024;
const MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES = 10 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 20;
const ISSUE_ARCHIVE_ENTRIES = ['Chart.csv', 'Metadata.csv', 'Table.csv'] as const;
const COVERAGE_ARCHIVE_ENTRIES = [
  'Chart.csv',
  'Critical issues.csv',
  'Metadata.csv',
  'Non-critical issues.csv',
] as const;
const COVERAGE_ONLY_ISSUES = ['Discovered - currently not indexed'] as const;
type CoverageIssue = GscIssue | (typeof COVERAGE_ONLY_ISSUES)[number];

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function formatCrc32(value: number) {
  return (value >>> 0).toString(16).padStart(8, '0');
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

export function calculateCrc32(input: Buffer) {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minimumOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

export function readZipEntries(buffer: Buffer): ZipEntry[] {
  invariant(buffer.length <= MAX_ZIP_ARCHIVE_BYTES, `ZIP archive exceeds ${MAX_ZIP_ARCHIVE_BYTES} byte limit.`);
  const eocdOffset = findEndOfCentralDirectory(buffer);
  invariant(eocdOffset >= 0, 'ZIP end-of-central-directory record was not found.');
  invariant(buffer.readUInt16LE(eocdOffset + 4) === 0, 'Multi-disk ZIP archives are unsupported.');
  invariant(buffer.readUInt16LE(eocdOffset + 6) === 0, 'Multi-disk ZIP archives are unsupported.');

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  invariant(entryCount <= MAX_ZIP_ENTRIES, `ZIP archive exceeds ${MAX_ZIP_ENTRIES} entry limit.`);
  invariant(
    buffer.readUInt16LE(eocdOffset + 8) === entryCount,
    'ZIP central-directory entry counts do not match.'
  );
  const centralDirectoryBytes = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  invariant(
    centralDirectoryOffset + centralDirectoryBytes <= eocdOffset,
    'ZIP central directory lies outside the archive bounds.'
  );
  let offset = centralDirectoryOffset;
  const entries: ZipEntry[] = [];
  const entryNames = new Set<string>();
  let totalUncompressedBytes = 0;

  for (let index = 0; index < entryCount; index += 1) {
    invariant(buffer.readUInt32LE(offset) === 0x02014b50, 'Invalid ZIP central-directory entry.');
    const flags = buffer.readUInt16LE(offset + 8);
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const expectedCrc32 = buffer.readUInt32LE(offset + 16);
    const compressedBytes = buffer.readUInt32LE(offset + 20);
    const uncompressedBytes = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    invariant(
      offset + 46 + fileNameLength + extraLength + commentLength <= eocdOffset,
      'Truncated ZIP central-directory entry.'
    );
    invariant((flags & 0x1) === 0, 'Encrypted ZIP entries are unsupported.');
    invariant(
      compressedBytes !== 0xffffffff &&
        uncompressedBytes !== 0xffffffff &&
        localHeaderOffset !== 0xffffffff,
      'ZIP64 entries are unsupported.'
    );
    invariant(
      compressionMethod === 0 || compressionMethod === 8,
      `Unsupported ZIP compression method ${compressionMethod}.`
    );

    const fileName = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString((flags & 0x800) !== 0 ? 'utf8' : 'utf8');
    invariant(fileName.length > 0 && !fileName.includes('\0'), 'ZIP entry has an invalid filename.');
    invariant(
      !/^(?:[a-z]:|[\\/])/i.test(fileName) && !fileName.split(/[\\/]/).includes('..'),
      `ZIP entry uses an unsafe path: ${fileName}`
    );
    invariant(!entryNames.has(fileName), `Duplicate ZIP entry: ${fileName}`);
    entryNames.add(fileName);
    invariant(
      uncompressedBytes <= MAX_ZIP_ENTRY_BYTES,
      `ZIP entry ${fileName} exceeds the ${MAX_ZIP_ENTRY_BYTES} byte size limit.`
    );
    totalUncompressedBytes += uncompressedBytes;
    invariant(
      totalUncompressedBytes <= MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES,
      `ZIP archive exceeds the ${MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES} byte uncompressed size limit.`
    );
    invariant(
      localHeaderOffset + 30 <= centralDirectoryOffset,
      `Invalid ZIP local header offset for ${fileName}.`
    );
    invariant(buffer.readUInt32LE(localHeaderOffset) === 0x04034b50, 'Invalid ZIP local header.');
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const localFileName = buffer
      .subarray(localHeaderOffset + 30, localHeaderOffset + 30 + localNameLength)
      .toString((flags & 0x800) !== 0 ? 'utf8' : 'utf8');
    invariant(localFileName === fileName, `ZIP local/central filename mismatch for ${fileName}.`);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    invariant(dataOffset + compressedBytes <= centralDirectoryOffset, `Truncated ZIP entry: ${fileName}`);
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedBytes);
    invariant(compressed.length === compressedBytes, `Truncated ZIP entry: ${fileName}`);
    const data =
      compressionMethod === 0
        ? Buffer.from(compressed)
        : inflateRawSync(compressed, { maxOutputLength: MAX_ZIP_ENTRY_BYTES });
    invariant(data.length === uncompressedBytes, `ZIP size mismatch for ${fileName}.`);
    invariant(calculateCrc32(data) === expectedCrc32, `ZIP CRC mismatch for ${fileName}.`);

    if (!fileName.endsWith('/')) {
      entries.push({
        name: fileName,
        compressionMethod,
        compressedBytes,
        uncompressedBytes,
        crc32: formatCrc32(expectedCrc32),
        data,
      });
    }
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  invariant(entries.length > 0, 'ZIP archive contains no files.');
  return entries;
}

export function parseCsv(input: string): CsvRow[] {
  const source = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: CsvRow[] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let afterClosingQuote = false;

  const pushField = () => {
    row.push(field);
    field = '';
    afterClosingQuote = false;
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          afterClosingQuote = true;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (afterClosingQuote && char !== ',' && char !== '\r' && char !== '\n') {
      throw new Error(`Malformed CSV: unexpected character after closing quote at offset ${index}.`);
    }
    if (char === '"') {
      invariant(field.length === 0, `Malformed CSV: unexpected quote at offset ${index}.`);
      inQuotes = true;
    } else if (char === ',') {
      pushField();
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      pushRow();
    } else {
      field += char;
    }
  }

  invariant(!inQuotes, 'Malformed CSV: unterminated quoted field.');
  if (field.length > 0 || row.length > 0 || afterClosingQuote) pushRow();
  if (rows.length > 0 && rows.at(-1)?.every((value) => value === '')) rows.pop();
  return rows;
}

function csvObjects(rows: CsvRow[], expectedHeader: string[], source: string) {
  invariant(rows.length > 0, `${source} is empty.`);
  invariant(
    JSON.stringify(rows[0]) === JSON.stringify(expectedHeader),
    `${source} header is ${JSON.stringify(rows[0])}; expected ${JSON.stringify(expectedHeader)}.`
  );
  return rows.slice(1).map((row, index) => {
    invariant(
      row.length === expectedHeader.length,
      `${source} row ${index + 2} has ${row.length} columns; expected ${expectedHeader.length}.`
    );
    return Object.fromEntries(expectedHeader.map((header, column) => [header, row[column]]));
  });
}

function decodeCsv(entry: ZipEntry) {
  return parseCsv(entry.data.toString('utf8'));
}

function requireEntry(entries: Map<string, ZipEntry>, name: string, archive: string) {
  const entry = entries.get(name);
  invariant(entry, `${archive} is missing ${name}.`);
  return entry;
}

function normalizeIssueText(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeIssue(value: string): GscIssue | null {
  const normalized = normalizeIssueText(value);
  return (
    GSC_ISSUES.find((issue) => normalizeIssueText(issue) === normalized) || null
  );
}

function normalizeCoverageIssue(value: string): CoverageIssue | null {
  const issue = normalizeIssue(value);
  if (issue) return issue;
  const normalized = normalizeIssueText(value);
  return COVERAGE_ONLY_ISSUES.find((candidate) => normalizeIssueText(candidate) === normalized) || null;
}

function parseIsoDate(value: string, context: string) {
  invariant(/^\d{4}-\d{2}-\d{2}$/.test(value), `${context} has invalid date ${value}.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  invariant(!Number.isNaN(date.getTime()), `${context} has invalid date ${value}.`);
  return date;
}

function validateContinuousDates(values: string[], context: string) {
  for (let index = 1; index < values.length; index += 1) {
    const previous = parseIsoDate(values[index - 1], context);
    const current = parseIsoDate(values[index], context);
    invariant(current.getTime() - previous.getTime() === 86_400_000, `${context} has a date gap.`);
  }
}

function cleanPathname(pathname: string) {
  if (pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

export function normalizeComparisonUrl(value: string) {
  const url = new URL(value);
  invariant(url.protocol === 'http:' || url.protocol === 'https:', 'URL must use HTTP(S).');
  url.hash = '';
  url.pathname = cleanPathname(url.pathname);
  return url.toString();
}

export function normalizeLogicalUrl(value: string) {
  const url = new URL(normalizeComparisonUrl(value));
  const pairs = Array.from(url.searchParams.entries()).sort(([leftKey, leftValue], [rightKey, rightValue]) =>
    leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey)
  );
  url.search = '';
  for (const [key, value] of pairs) url.searchParams.append(key, value);
  return url.toString();
}

export function analyzeRawUrl(rawUrl: string, baseUrl: string) {
  const hasWhitespace = /\s/u.test(rawUrl);
  if (hasWhitespace) {
    return {
      normalizedComparisonUrl: null,
      logicalComparisonUrl: null,
      hasWhitespace,
      malformedReason: 'Raw URL contains whitespace and is preserved without repair.',
    };
  }
  try {
    const normalizedComparisonUrl = normalizeComparisonUrl(rawUrl);
    const parsed = new URL(normalizedComparisonUrl);
    if (parsed.origin !== new URL(baseUrl).origin) {
      return {
        normalizedComparisonUrl,
        logicalComparisonUrl: normalizeLogicalUrl(normalizedComparisonUrl),
        hasWhitespace,
        malformedReason: 'Input URL uses an origin outside the configured property.',
      };
    }
    return {
      normalizedComparisonUrl,
      logicalComparisonUrl: normalizeLogicalUrl(normalizedComparisonUrl),
      hasWhitespace,
      malformedReason: '',
    };
  } catch (error) {
    return {
      normalizedComparisonUrl: null,
      logicalComparisonUrl: null,
      hasWhitespace,
      malformedReason: error instanceof Error ? error.message : String(error),
    };
  }
}

function inferContentType(value: string | null) {
  if (!value) return 'unknown';
  const path = new URL(value).pathname;
  if (path === '/' || cleanPathname(path) === '/main') return 'homepage';
  if (path.startsWith('/main/article/')) return 'article';
  if (path === '/main/stories') return 'legacy-story';
  if (path.startsWith('/main/category/')) return 'category';
  if (path === '/main/search') return 'search';
  if (path === '/main/epaper') return 'epaper';
  if (path === '/main/e-magazine') return 'e-magazine';
  if (path === '/main/saved') return 'saved';
  if (path.startsWith('/a/')) return 'short-article';
  if (path.startsWith('/e/')) return 'short-epaper';
  if (path.startsWith('/main/')) return 'reader-static';
  return 'other';
}

function extractAttributes(tag: string) {
  const attributes: Record<string, string> = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/g)) {
    attributes[match[1].toLowerCase()] = match[3];
  }
  return attributes;
}

export function extractHtmlSeo(html: string, pageUrl: string) {
  const canonicals: string[] = [];
  const robotsMeta: string[] = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = extractAttributes(match[0]);
    const rel = String(attrs.rel || '').toLowerCase().split(/\s+/);
    if (!rel.includes('canonical') || !attrs.href) continue;
    const href = decodeXmlEntities(attrs.href);
    try {
      canonicals.push(normalizeComparisonUrl(new URL(href, pageUrl).toString()));
    } catch {
      canonicals.push(href);
    }
  }
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = extractAttributes(match[0]);
    const name = String(attrs.name || '').toLowerCase();
    if ((name === 'robots' || name === 'googlebot') && attrs.content) {
      robotsMeta.push(`${name}:${attrs.content}`);
    }
  }
  return { canonicals, robotsMeta };
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function extractSitemapLocations(xml: string) {
  return Array.from(xml.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi))
    .map((match) => decodeXmlEntities(match[1]).trim())
    .filter(Boolean);
}

function abortError(signal: AbortSignal) {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException('The operation was aborted.', 'AbortError');
}

function readStreamChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal?: AbortSignal
): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (!signal) return reader.read();
  if (signal.aborted) return Promise.reject(abortError(signal));
  return new Promise((resolve, reject) => {
    let settled = false;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      reject(abortError(signal));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    reader.read().then(
      (result) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', onAbort);
        resolve(result);
      },
      (error) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', onAbort);
        reject(error);
      }
    );
  });
}

export async function readResponseText(response: Response, signal?: AbortSignal) {
  const contentLength = Number.parseInt(response.headers.get('content-length') || '', 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    const error = new Error(`Response exceeds ${MAX_RESPONSE_BYTES} bytes.`);
    if (response.body) await response.body.cancel(error).catch(() => undefined);
    throw error;
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const bytes = Buffer.allocUnsafe(MAX_RESPONSE_BYTES);
  let byteLength = 0;
  let cancelled = false;
  try {
    while (true) {
      const result = await readStreamChunk(reader, signal);
      if (result.done) break;
      if (result.value.byteLength === 0) continue;
      if (byteLength + result.value.byteLength > MAX_RESPONSE_BYTES) {
        const error = new Error(`Response exceeds ${MAX_RESPONSE_BYTES} bytes.`);
        await reader.cancel(error).catch(() => undefined);
        cancelled = true;
        throw error;
      }
      Buffer.from(result.value.buffer, result.value.byteOffset, result.value.byteLength).copy(bytes, byteLength);
      byteLength += result.value.byteLength;
    }
    return bytes.subarray(0, byteLength).toString('utf8');
  } catch (error) {
    if (!cancelled) await reader.cancel(error).catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

async function fetchTextWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await readResponseText(response, controller.signal);
    return { response, text };
  } catch (error) {
    if (timedOut) {
      throw new Error(`${url} timed out after ${timeoutMs}ms while reading headers or body.`, {
        cause: error,
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRedirectChain(
  requestedUrl: string,
  baseUrl: string,
  timeoutMs: number,
  maxRedirects: number,
  requestHeaders: Record<string, string> = { accept: 'text/html,application/xhtml+xml' }
) {
  const origin = new URL(baseUrl).origin;
  let currentUrl = normalizeComparisonUrl(requestedUrl);
  const visited = new Set<string>();
  const redirectChain: RedirectHop[] = [];

  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const key = normalizeComparisonUrl(currentUrl);
    if (visited.has(key)) {
      return {
        status: null,
        finalUrl: currentUrl,
        text: '',
        headers: new Headers(),
        redirectChain,
        redirectLoop: true,
        externalRedirect: new URL(currentUrl).origin !== origin,
      };
    }
    visited.add(key);
    if (new URL(currentUrl).origin !== origin) {
      return {
        status: redirectChain.at(-1)?.status || null,
        finalUrl: currentUrl,
        text: '',
        headers: new Headers(),
        redirectChain,
        redirectLoop: false,
        externalRedirect: true,
      };
    }

    const { response, text } = await fetchTextWithTimeout(
      currentUrl,
      {
        method: 'GET',
        redirect: 'manual',
        headers: {
          ...requestHeaders,
          'user-agent': 'Lokswami-SEO-Index-Audit/1.0',
        },
      },
      timeoutMs
    );
    const location = response.headers.get('location') || '';
    if (REDIRECT_STATUSES.has(response.status) && location) {
      const nextUrl = normalizeComparisonUrl(new URL(location, currentUrl).toString());
      redirectChain.push({ url: currentUrl, status: response.status, location: nextUrl });
      currentUrl = nextUrl;
      continue;
    }
    return {
      status: response.status,
      finalUrl: normalizeComparisonUrl(response.url || currentUrl),
      text,
      headers: response.headers,
      redirectChain,
      redirectLoop: false,
      externalRedirect: false,
    };
  }
  throw new Error(`${requestedUrl} exceeded ${maxRedirects} redirects.`);
}

function emptyInspection(row: SourceRow): PageInspection {
  return {
    httpStatus: null,
    finalUrl: row.normalizedComparisonUrl,
    redirectChain: [],
    redirectLoop: false,
    externalRedirect: false,
    canonical: null,
    canonicals: [],
    robotsMeta: [],
    xRobotsTag: '',
    noindex: false,
    contentTypeHeader: '',
    fetchError: '',
    standardSitemapMember: false,
    newsSitemapMember: false,
    contentType: inferContentType(row.normalizedComparisonUrl),
    publishedPublicStatus: inferContentType(row.normalizedComparisonUrl) === 'article' ? 'unknown' : 'not_applicable',
    configuredArticleCanonical: null,
    articleResolutionEvidence: '',
    articleReplacementVerified: false,
  };
}

function getArticleToken(value: string | null) {
  if (!value) return '';
  const match = new URL(value).pathname.match(/^\/main\/article\/([^/]+)\/?$/i);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function getPayloadData(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;
  const source = payload as Record<string, unknown>;
  const data = source.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const dataObject = data as Record<string, unknown>;
  if (dataObject.article && typeof dataObject.article === 'object') {
    return dataObject.article as Record<string, unknown>;
  }
  return dataObject;
}

export async function resolvePublicArticle(
  token: string,
  baseUrl: string,
  timeoutMs: number,
  finalUrl: string | null,
  maxRedirects: number
): Promise<
  Pick<
    PageInspection,
    | 'publishedPublicStatus'
    | 'configuredArticleCanonical'
    | 'articleResolutionEvidence'
    | 'articleReplacementVerified'
  >
> {
  if (!token) {
    return {
      publishedPublicStatus: 'unknown',
      configuredArticleCanonical: null,
      articleResolutionEvidence: 'Article token could not be derived from the public URL.',
      articleReplacementVerified: false,
    };
  }
  const apiUrl = new URL(`/api/v1/public/articles/${encodeURIComponent(token)}`, `${baseUrl}/`).toString();
  try {
    const fetched = await fetchRedirectChain(
      apiUrl,
      baseUrl,
      timeoutMs,
      maxRedirects,
      { accept: 'application/json' }
    );
    if (fetched.externalRedirect || fetched.redirectLoop) {
      return {
        publishedPublicStatus: 'unknown',
        configuredArticleCanonical: null,
        articleResolutionEvidence: fetched.externalRedirect
          ? 'Public article detail attempted an external redirect and was not followed.'
          : 'Public article detail entered a redirect loop.',
        articleReplacementVerified: false,
      };
    }
    if (fetched.status === 404) {
      return {
        publishedPublicStatus: 'not_public',
        configuredArticleCanonical: null,
        articleResolutionEvidence: 'Public article detail returned 404.',
        articleReplacementVerified: false,
      };
    }
    if (fetched.status !== 200) {
      return {
        publishedPublicStatus: 'unknown',
        configuredArticleCanonical: null,
        articleResolutionEvidence: `Public article detail returned ${fetched.status}.`,
        articleReplacementVerified: false,
      };
    }
    const article = getPayloadData(JSON.parse(fetched.text));
    if (!article) {
      return {
        publishedPublicStatus: 'unknown',
        configuredArticleCanonical: null,
        articleResolutionEvidence: 'Public article detail returned no article object.',
        articleReplacementVerified: false,
      };
    }
    const seo = article.seo && typeof article.seo === 'object' ? (article.seo as Record<string, unknown>) : {};
    const rawCanonical = typeof seo.canonicalUrl === 'string' ? seo.canonicalUrl.trim() : '';
    let configuredArticleCanonical: string | null = null;
    if (rawCanonical) {
      try {
        const candidate = normalizeComparisonUrl(rawCanonical);
        configuredArticleCanonical = new URL(candidate).origin === new URL(baseUrl).origin ? candidate : rawCanonical;
      } catch {
        configuredArticleCanonical = rawCanonical;
      }
    }
    const resolvedSlug = typeof article.slug === 'string' ? article.slug.trim() : '';
    let articleReplacementVerified = false;
    if (resolvedSlug && finalUrl) {
      const expectedPublicUrl = normalizeComparisonUrl(
        new URL(`/main/article/${encodeURIComponent(resolvedSlug)}`, `${baseUrl}/`).toString()
      );
      articleReplacementVerified = expectedPublicUrl === normalizeComparisonUrl(finalUrl);
    }
    return {
      publishedPublicStatus: 'public',
      configuredArticleCanonical,
      articleResolutionEvidence: articleReplacementVerified
        ? 'Original article token resolved through the published API and its slug matches the final public article URL.'
        : 'Public article detail resolved a published article, but its slug did not verify the final public article URL.',
      articleReplacementVerified,
    };
  } catch (error) {
    return {
      publishedPublicStatus: 'unknown',
      configuredArticleCanonical: null,
      articleResolutionEvidence: `Public article detail error: ${error instanceof Error ? error.message : String(error)}`,
      articleReplacementVerified: false,
    };
  }
}

async function inspectPage(
  row: SourceRow,
  baseUrl: string,
  timeoutMs: number,
  maxRedirects: number,
  standardSitemap: Set<string>,
  newsSitemap: Set<string>
) {
  const inspection = emptyInspection(row);
  if (!row.normalizedComparisonUrl || row.malformedReason) {
    inspection.fetchError = row.malformedReason || 'URL could not be normalized.';
    return inspection;
  }
  inspection.standardSitemapMember = standardSitemap.has(row.normalizedComparisonUrl);
  inspection.newsSitemapMember = newsSitemap.has(row.normalizedComparisonUrl);
  try {
    const fetched = await fetchRedirectChain(
      row.normalizedComparisonUrl,
      baseUrl,
      timeoutMs,
      maxRedirects
    );
    inspection.httpStatus = fetched.status;
    inspection.finalUrl = fetched.finalUrl;
    inspection.redirectChain = fetched.redirectChain;
    inspection.redirectLoop = fetched.redirectLoop;
    inspection.externalRedirect = fetched.externalRedirect;
    inspection.contentTypeHeader = fetched.headers.get('content-type') || '';
    inspection.xRobotsTag = fetched.headers.get('x-robots-tag') || '';
    if (/html/i.test(inspection.contentTypeHeader) || /<html\b/i.test(fetched.text)) {
      const htmlSeo = extractHtmlSeo(fetched.text, fetched.finalUrl || row.normalizedComparisonUrl);
      inspection.canonicals = htmlSeo.canonicals;
      inspection.robotsMeta = htmlSeo.robotsMeta;
      inspection.canonical = htmlSeo.canonicals[0] || null;
    }
    inspection.noindex = [...inspection.robotsMeta, inspection.xRobotsTag].some((value) =>
      /(?:^|[:,\s])noindex(?:$|[,\s])/i.test(value)
    );
    if (inspection.contentType === 'article') {
      Object.assign(
        inspection,
        await resolvePublicArticle(
          getArticleToken(row.normalizedComparisonUrl),
          baseUrl,
          timeoutMs,
          inspection.finalUrl,
          maxRedirects
        )
      );
    }
  } catch (error) {
    inspection.fetchError = error instanceof Error ? error.message : String(error);
  }
  return inspection;
}

function uniqueNormalized(values: string[]) {
  return new Set(
    values.map((value) => {
      try {
        return normalizeComparisonUrl(value);
      } catch {
        return value;
      }
    })
  );
}

function inspectCanonicalUrl(value: string, pageUrl: string) {
  try {
    const canonical = normalizeComparisonUrl(new URL(value, pageUrl).toString());
    return {
      invalid: false,
      external: new URL(canonical).origin !== new URL(pageUrl).origin,
    };
  } catch {
    return { invalid: true, external: false };
  }
}

export function classifyRecord(row: SourceRow, page: PageInspection): Classification {
  const evidence: string[] = [];
  if (row.malformedReason) evidence.push(row.malformedReason);
  if (page.fetchError) evidence.push(page.fetchError);
  if (page.httpStatus !== null) evidence.push(`HTTP ${page.httpStatus}.`);
  if (page.redirectChain.length > 0) evidence.push(`${page.redirectChain.length}-hop redirect chain.`);
  if (page.canonical) evidence.push(`Canonical: ${page.canonical}`);
  if (page.noindex) evidence.push('Robots directives contain noindex.');
  if (page.standardSitemapMember) evidence.push('URL is in the standard sitemap.');
  if (page.newsSitemapMember) evidence.push('URL is in the news sitemap.');
  if (page.articleResolutionEvidence) evidence.push(page.articleResolutionEvidence);

  const manual = (reason: string): Classification => ({
    proposedAction: 'MANUAL_REVIEW',
    proposedTarget: null,
    confidence: 'low',
    evidence,
    manualReviewReason: reason,
  });

  if (row.malformedReason) return manual(row.malformedReason);
  if (page.fetchError) return manual('The live URL could not be inspected reliably.');
  if (page.redirectLoop) return manual('Redirect loop detected.');
  if (page.externalRedirect) return manual('Redirect leaves the configured production origin.');
  if (uniqueNormalized(page.canonicals).size > 1) return manual('Multiple conflicting canonicals were found.');
  const canonicalState = page.canonical
    ? inspectCanonicalUrl(page.canonical, page.finalUrl || row.rawUrl)
    : null;
  if (canonicalState?.invalid) return manual('Canonical URL is malformed.');
  if (canonicalState?.external) {
    return manual('Canonical points to an external origin.');
  }
  if (
    page.contentType === 'article' &&
    page.publishedPublicStatus === 'not_public' &&
    page.httpStatus === 200 &&
    !page.noindex &&
    !page.standardSitemapMember &&
    !page.newsSitemapMember
  ) {
    return manual('The article is proven not public, but its current HTTP 200 response is indexable.');
  }
  if (page.publishedPublicStatus === 'not_public' && (page.standardSitemapMember || page.newsSitemapMember)) {
    return {
      proposedAction: 'REMOVE_FROM_SITEMAP',
      proposedTarget: null,
      confidence: 'high',
      evidence,
      manualReviewReason: null,
    };
  }
  if ((page.standardSitemapMember || page.newsSitemapMember) && page.httpStatus !== 200) {
    return {
      proposedAction: 'REMOVE_FROM_SITEMAP',
      proposedTarget: null,
      confidence: 'high',
      evidence,
      manualReviewReason: null,
    };
  }
  if ((page.standardSitemapMember || page.newsSitemapMember) && page.noindex) {
    return {
      proposedAction: 'REMOVE_FROM_SITEMAP',
      proposedTarget: null,
      confidence: 'high',
      evidence,
      manualReviewReason: null,
    };
  }

  if (
    page.contentType === 'saved' &&
    (page.noindex ||
      (page.finalUrl && new URL(page.finalUrl).pathname === '/signin'))
  ) {
    evidence.push('The private saved-content route is robots-disallowed and redirects unauthenticated readers to sign-in.');
    return {
      proposedAction: 'INTENTIONAL_NOINDEX',
      proposedTarget: null,
      confidence: 'high',
      evidence,
      manualReviewReason: null,
    };
  }

  if (page.redirectChain.length > 0) {
    if (page.httpStatus === 200 && page.finalUrl) {
      if (page.contentType === 'article' && !page.articleReplacementVerified) {
        return manual('Article replacement target lacks verified published id, slug, or slug-history evidence.');
      }
      return {
        proposedAction: 'REDIRECT_TO_REPLACEMENT',
        proposedTarget: page.finalUrl,
        confidence: 'high',
        evidence,
        manualReviewReason: null,
      };
    }
    return manual('Redirect target did not resolve to an internal HTTP 200 page.');
  }

  switch (row.sourceIssue) {
    case 'Alternate page with proper canonical tag':
      if (page.httpStatus === 200 && page.canonical) {
        return {
          proposedAction: 'KEEP',
          proposedTarget: page.canonical,
          confidence: page.canonical === page.finalUrl ? 'medium' : 'high',
          evidence,
          manualReviewReason: null,
        };
      }
      return manual('The alternate page no longer has a usable canonical on a 200 response.');
    case 'Not found (404)':
      if (page.httpStatus === 200 && page.canonical) {
        return {
          proposedAction: 'KEEP',
          proposedTarget: page.canonical,
          confidence: 'medium',
          evidence,
          manualReviewReason: null,
        };
      }
      return {
        proposedAction: 'INVESTIGATE_CONTENT',
        proposedTarget: null,
        confidence: 'low',
        evidence,
        manualReviewReason: 'No evidence-backed replacement target was found; do not guess a redirect.',
      };
    case 'Duplicate without user-selected canonical':
      if (page.contentType === 'search') {
        return manual('Search-result URL policy is not explicit enough to choose canonical versus noindex automatically.');
      }
      if (page.httpStatus === 200 && !page.canonical && !page.noindex) {
        if (page.contentType === 'article' && page.publishedPublicStatus !== 'public') {
          return manual('Article publication status is not positively verified as public.');
        }
        return {
          proposedAction: 'SELF_CANONICAL',
          proposedTarget: page.finalUrl,
          confidence: 'medium',
          evidence,
          manualReviewReason: null,
        };
      }
      if (page.httpStatus === 200 && page.canonical) {
        return {
          proposedAction: 'KEEP',
          proposedTarget: page.canonical,
          confidence: 'medium',
          evidence,
          manualReviewReason: null,
        };
      }
      return manual('Duplicate URL does not have enough current evidence for a canonical decision.');
    case 'Excluded by ‘noindex’ tag':
      if (page.noindex && page.publishedPublicStatus === 'not_public' && !page.standardSitemapMember && !page.newsSitemapMember) {
        return {
          proposedAction: 'INTENTIONAL_NOINDEX',
          proposedTarget: null,
          confidence: 'high',
          evidence,
          manualReviewReason: null,
        };
      }
      if (page.noindex && (page.contentType === 'saved' || page.publishedPublicStatus === 'not_public')) {
        return {
          proposedAction: 'INTENTIONAL_NOINDEX',
          proposedTarget: null,
          confidence: 'medium',
          evidence,
          manualReviewReason: null,
        };
      }
      return manual('Current public/indexability evidence does not prove that noindex is intentional.');
    case 'Page with redirect':
      if (page.httpStatus === 200 && page.canonical) {
        return {
          proposedAction: 'KEEP',
          proposedTarget: page.canonical,
          confidence: 'medium',
          evidence,
          manualReviewReason: null,
        };
      }
      return manual('GSC reports a redirect, but no current evidence-backed redirect target was found.');
    case 'Crawled - currently not indexed':
      if (page.noindex && page.contentType === 'saved') {
        return {
          proposedAction: 'INTENTIONAL_NOINDEX',
          proposedTarget: null,
          confidence: 'high',
          evidence,
          manualReviewReason: null,
        };
      }
      return {
        proposedAction: 'INVESTIGATE_CONTENT',
        proposedTarget: page.canonical || page.finalUrl,
        confidence: page.httpStatus === 200 && Boolean(page.canonical) && !page.noindex ? 'medium' : 'low',
        evidence,
        manualReviewReason:
          page.httpStatus === 200 && Boolean(page.canonical) && !page.noindex
            ? null
            : 'The page lacks a clean 200/indexable/canonical evidence set.',
      };
  }
}

function getEntryInventory(entry: ZipEntry) {
  const rows = decodeCsv(entry);
  return {
    name: entry.name,
    rows: Math.max(0, rows.length - 1),
    header: rows[0] || [],
    bytes: entry.uncompressedBytes,
    compressedBytes: entry.compressedBytes,
    crc32: entry.crc32,
  };
}

function metadataMap(entry: ZipEntry, archive: string) {
  const rows = csvObjects(decodeCsv(entry), EXPECTED_METADATA_HEADER, `${archive}/Metadata.csv`);
  const metadata = new Map<string, string>();
  for (const row of rows) {
    invariant(row.Property.length > 0, `${archive}/Metadata.csv contains an empty property.`);
    invariant(!metadata.has(row.Property), `${archive}/Metadata.csv contains duplicate property ${row.Property}.`);
    metadata.set(row.Property, row.Value);
  }
  return metadata;
}

function assertExactArchiveEntries(
  actualEntries: ZipEntry[],
  expectedEntries: readonly string[],
  fileName: string
) {
  const actual = actualEntries.map((entry) => entry.name).sort();
  const expected = [...expectedEntries].sort();
  invariant(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${fileName} has unexpected ZIP entries ${JSON.stringify(actual)}; expected ${JSON.stringify(expected)}.`
  );
}

export function parseGscArchive(buffer: Buffer, fileName: string, baseUrl: string): ParsedGscArchive {
  const zipEntries = readZipEntries(buffer);
  invariant(zipEntries.every((entry) => entry.name.toLowerCase().endsWith('.csv')), `${fileName} contains a non-CSV file.`);
  const entries = new Map(zipEntries.map((entry) => [entry.name, entry]));
  const metadata = metadataMap(requireEntry(entries, 'Metadata.csv', fileName), fileName);
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const common = {
    fileName,
    bytes: buffer.length,
    sha256,
    validZip: true,
    entries: zipEntries.map(getEntryInventory),
  };

  if (entries.has('Table.csv')) {
    assertExactArchiveEntries(zipEntries, ISSUE_ARCHIVE_ENTRIES, fileName);
    invariant(
      metadata.get('Sitemap') === 'All known pages',
      `${fileName} has unsupported Metadata.csv Sitemap value.`
    );
    invariant(metadata.size === 2, `${fileName} has unexpected Metadata.csv properties.`);
    const rawIssue = metadata.get('Issue') || '';
    const issue = normalizeIssue(rawIssue);
    invariant(issue, `${fileName} has unsupported Metadata.csv issue: ${rawIssue}`);
    const tableRows = csvObjects(
      decodeCsv(requireEntry(entries, 'Table.csv', fileName)),
      EXPECTED_TABLE_HEADER,
      `${fileName}/Table.csv`
    );
    const chartRows = csvObjects(
      decodeCsv(requireEntry(entries, 'Chart.csv', fileName)),
      EXPECTED_ISSUE_CHART_HEADER,
      `${fileName}/Chart.csv`
    );
    invariant(chartRows.length > 0, `${fileName}/Chart.csv has no rows.`);
    validateContinuousDates(chartRows.map((row) => row.Date), `${fileName}/Chart.csv`);
    const latestAffectedPages = Number.parseInt(chartRows.at(-1)?.['Affected pages'] || '', 10);
    invariant(Number.isFinite(latestAffectedPages), `${fileName}/Chart.csv latest count is invalid.`);
    invariant(
      latestAffectedPages === tableRows.length,
      `${fileName} Table.csv has ${tableRows.length} rows but latest chart count is ${latestAffectedPages}.`
    );
    const rows: SourceRow[] = tableRows.map((row, index) => {
      parseIsoDate(row['Last crawled'], `${fileName}/Table.csv row ${index + 2}`);
      return {
        rowId: `${String(GSC_ISSUES.indexOf(issue) + 1).padStart(2, '0')}-${String(index + 1).padStart(3, '0')}`,
        archive: fileName,
        csvRow: index + 2,
        sourceIssue: issue,
        rawUrl: row.URL,
        lastCrawled: row['Last crawled'],
        ...analyzeRawUrl(row.URL, baseUrl),
      };
    });
    const inventory: ArchiveInventory = {
      ...common,
      kind: 'issue',
      issue,
      chart: {
        from: chartRows[0].Date,
        to: chartRows.at(-1)?.Date || '',
        rows: chartRows.length,
        latestAffectedPages,
      },
    };
    return { inventory, rows, coverage: null };
  }

  assertExactArchiveEntries(zipEntries, COVERAGE_ARCHIVE_ENTRIES, fileName);
  invariant(
    metadata.get('Sitemap') === 'All known pages',
    `${fileName} has unsupported Metadata.csv Sitemap value.`
  );
  invariant(metadata.size === 1, `${fileName} has unexpected Metadata.csv properties.`);

  const chartRows = csvObjects(
    decodeCsv(requireEntry(entries, 'Chart.csv', fileName)),
    EXPECTED_COVERAGE_CHART_HEADER,
    `${fileName}/Chart.csv`
  );
  invariant(chartRows.length > 0, `${fileName}/Chart.csv has no rows.`);
  validateContinuousDates(chartRows.map((row) => row.Date), `${fileName}/Chart.csv`);
  const latest = chartRows.at(-1);
  invariant(latest, `${fileName}/Chart.csv has no latest row.`);
  const indexed = Number.parseInt(latest.Indexed, 10);
  const notIndexed = Number.parseInt(latest['Not indexed'], 10);
  invariant(Number.isFinite(indexed) && Number.isFinite(notIndexed), `${fileName} latest Coverage counts are invalid.`);
  const criticalRows = csvObjects(
    decodeCsv(requireEntry(entries, 'Critical issues.csv', fileName)),
    EXPECTED_COVERAGE_ISSUES_HEADER,
    `${fileName}/Critical issues.csv`
  );
  const nonCriticalRows = csvObjects(
    decodeCsv(requireEntry(entries, 'Non-critical issues.csv', fileName)),
    EXPECTED_COVERAGE_ISSUES_HEADER,
    `${fileName}/Non-critical issues.csv`
  );
  const issues = [...criticalRows, ...nonCriticalRows].map((row) => ({
    reason: row.Reason,
    source: row.Source,
    validation: row.Validation,
    pages: Number.parseInt(row.Pages, 10),
  }));
  invariant(issues.every((issue) => Number.isFinite(issue.pages)), `${fileName} has invalid issue counts.`);
  const coverage: CoverageSummary = {
    latestDate: latest.Date,
    indexed,
    notIndexed,
    totalKnown: indexed + notIndexed,
    issues,
  };
  const inventory: ArchiveInventory = {
    ...common,
    kind: 'coverage',
    chart: { from: chartRows[0].Date, to: latest.Date, rows: chartRows.length },
  };
  return { inventory, rows: [] as SourceRow[], coverage };
}

export function reconcileGscArchives(parsedArchives: ParsedGscArchive[]) {
  const inventories = parsedArchives.map((archive) => archive.inventory);
  const issueArchives = parsedArchives.filter((archive) => archive.inventory.kind === 'issue');
  const coverageArchives = parsedArchives.filter((archive) => archive.coverage !== null);
  invariant(
    issueArchives.length === GSC_ISSUES.length,
    `Expected ${GSC_ISSUES.length} issue archives; received ${issueArchives.length}.`
  );
  invariant(
    coverageArchives.length === 1,
    `Expected one Coverage summary archive; received ${coverageArchives.length}.`
  );

  const archivesByIssue = new Map<GscIssue, ParsedGscArchive>();
  for (const archive of issueArchives) {
    const issue = archive.inventory.issue;
    invariant(issue, `${archive.inventory.fileName} has no validated Metadata.csv issue.`);
    invariant(
      !archivesByIssue.has(issue),
      `Issue archives contain a duplicate or ambiguous Metadata.csv mapping for ${issue}.`
    );
    archivesByIssue.set(issue, archive);
  }
  for (const issue of GSC_ISSUES) {
    invariant(archivesByIssue.has(issue), `Issue archives are missing the Metadata.csv mapping for ${issue}.`);
  }

  const coverage = coverageArchives[0].coverage as CoverageSummary;
  const coverageByIssue = new Map<CoverageIssue, CoverageSummary['issues'][number]>();
  for (const coverageIssue of coverage.issues) {
    const issue = normalizeCoverageIssue(coverageIssue.reason);
    invariant(issue, `Coverage contains unknown issue reason: ${coverageIssue.reason}.`);
    invariant(
      !coverageByIssue.has(issue),
      `Coverage contains a duplicate or ambiguous issue-reason mapping for ${issue}.`
    );
    coverageByIssue.set(issue, coverageIssue);
  }

  const perIssue: IssueReconciliation[] = GSC_ISSUES.map((issue) => {
    const archive = archivesByIssue.get(issue) as ParsedGscArchive;
    const coverageIssue = coverageByIssue.get(issue);
    invariant(coverageIssue, `Coverage is missing the issue reason required for ${issue}.`);
    const archiveLatestDate = archive.inventory.chart?.to || '';
    invariant(
      archiveLatestDate.length > 0,
      `${archive.inventory.fileName} has no validated latest chart reporting date.`
    );
    invariant(
      archive.rows.length === coverageIssue.pages,
      `Per-issue reconciliation failed for ${issue}: Coverage reports ${coverageIssue.pages} pages, but issue archive ${archive.inventory.fileName} contains ${archive.rows.length} Table.csv rows.`
    );
    invariant(
      archiveLatestDate === coverage.latestDate,
      `Per-issue snapshot date mismatch for ${issue}: Coverage reports ${coverage.latestDate}, but issue archive ${archive.inventory.fileName} reports ${archiveLatestDate}.`
    );
    return {
      issue,
      archive: archive.inventory.fileName,
      archiveRows: archive.rows.length,
      coveragePages: coverageIssue.pages,
      archiveLatestDate,
      coverageLatestDate: coverage.latestDate,
    };
  });

  const sourceRows = issueArchives.flatMap((archive) => archive.rows);
  const exactUrls = new Set(sourceRows.map((row) => row.rawUrl));
  invariant(
    exactUrls.size === sourceRows.length,
    `Expected exact-unique input rows; found ${sourceRows.length - exactUrls.size} duplicates.`
  );
  const issueTotal = coverage.issues.reduce((total, issue) => total + issue.pages, 0);
  invariant(
    issueTotal === coverage.notIndexed,
    `Coverage issues total ${issueTotal}, not-indexed total ${coverage.notIndexed}.`
  );
  invariant(
    sourceRows.length === coverage.notIndexed,
    `Issue exports contain ${sourceRows.length} rows, Coverage reports ${coverage.notIndexed}.`
  );

  return {
    inventories,
    sourceRows,
    coverage,
    issueTotal,
    exactUniqueUrls: exactUrls.size,
    perIssue,
  };
}

export async function fetchSitemap(
  baseUrl: string,
  path: string,
  timeoutMs: number,
  maxRedirects = 10
) {
  const url = new URL(path, `${baseUrl}/`).toString();
  const fetched = await fetchRedirectChain(
    url,
    baseUrl,
    timeoutMs,
    maxRedirects,
    { accept: 'application/xml,text/xml' }
  );
  invariant(!fetched.externalRedirect, `${url} attempted an external redirect, which was not followed.`);
  invariant(!fetched.redirectLoop, `${url} entered a redirect loop.`);
  invariant(fetched.status === 200, `${url} returned ${fetched.status}.`);
  const locations = extractSitemapLocations(fetched.text).map(normalizeComparisonUrl);
  invariant(
    locations.every((location) => new URL(location).origin === new URL(baseUrl).origin),
    `${url} contains a URL outside the configured production origin.`
  );
  return { url, status: fetched.status, locations };
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  return results;
}

function addCrossRecordDetections(records: AuditRecord[]) {
  const logicalGroups = new Map<string, AuditRecord[]>();
  for (const record of records) {
    if (!record.logicalComparisonUrl) continue;
    const group = logicalGroups.get(record.logicalComparisonUrl) || [];
    group.push(record);
    logicalGroups.set(record.logicalComparisonUrl, group);
  }
  for (const group of logicalGroups.values()) {
    if (group.length < 2) continue;
    for (const record of group) {
      record.logicalDuplicateRowIds = group.filter((item) => item.rowId !== record.rowId).map((item) => item.rowId);
      record.detections.push('LOGICAL_QUERY_EQUIVALENT');
    }
  }

  const finalGroups = new Map<string, AuditRecord[]>();
  for (const record of records) {
    if (record.redirectChain.length === 0 || !record.finalUrl) continue;
    const final = normalizeComparisonUrl(record.finalUrl);
    const group = finalGroups.get(final) || [];
    group.push(record);
    finalGroups.set(final, group);
  }
  for (const group of finalGroups.values()) {
    const distinctLogicalSources = new Set(group.map((record) => record.logicalComparisonUrl || record.rawUrl));
    if (distinctLogicalSources.size < 2) continue;
    for (const record of group) {
      record.unrelatedManyToOneRedirect = true;
      record.detections.push('UNRELATED_MANY_TO_ONE_REDIRECT');
      record.proposedAction = 'MANUAL_REVIEW';
      record.proposedTarget = null;
      record.confidence = 'low';
      record.manualReviewReason = 'Multiple logically distinct source URLs redirect to the same target.';
    }
  }
}

function buildSummary(records: AuditRecord[]) {
  const byIssue: Record<string, Record<string, number>> = {};
  const byAction: Record<string, number> = {};
  for (const record of records) {
    byIssue[record.sourceIssue] ||= {};
    byIssue[record.sourceIssue][record.proposedAction] =
      (byIssue[record.sourceIssue][record.proposedAction] || 0) + 1;
    byAction[record.proposedAction] = (byAction[record.proposedAction] || 0) + 1;
  }
  return {
    totalRows: records.length,
    classifiedRows: records.filter((record) => Boolean(record.proposedAction)).length,
    processingErrors: records.filter((record) => Boolean(record.processingError)).length,
    manualReview: records.filter((record) => record.proposedAction === 'MANUAL_REVIEW').length,
    malformedOrWhitespace: records.filter((record) => Boolean(record.malformedReason)).length,
    logicalDuplicateGroups: new Set(
      records.filter((record) => record.logicalDuplicateRowIds.length > 0).map((record) => record.logicalComparisonUrl)
    ).size,
    redirectLoops: records.filter((record) => record.redirectLoop).length,
    externalCanonicals: records.filter(
      (record) =>
        record.canonical && inspectCanonicalUrl(record.canonical, record.finalUrl || record.rawUrl).external
    ).length,
    invalidCanonicals: records.filter(
      (record) =>
        record.canonical && inspectCanonicalUrl(record.canonical, record.finalUrl || record.rawUrl).invalid
    ).length,
    sitemapNon200: records.filter(
      (record) => (record.standardSitemapMember || record.newsSitemapMember) && record.httpStatus !== 200
    ).length,
    sitemapNoindex: records.filter(
      (record) => (record.standardSitemapMember || record.newsSitemapMember) && record.noindex
    ).length,
    unpublishedLeakage: records.filter(
      (record) =>
        (record.standardSitemapMember || record.newsSitemapMember) && record.publishedPublicStatus === 'not_public'
    ).length,
    byAction,
    byIssue,
  };
}

function csvEscape(value: unknown) {
  const text = Array.isArray(value) ? value.join(' | ') : value === null || value === undefined ? '' : String(value);
  const spreadsheetSafe = /^(?:[=+\-@]|\s+[=+\-@])/u.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(spreadsheetSafe)
    ? `"${spreadsheetSafe.replace(/"/g, '""')}"`
    : spreadsheetSafe;
}

export function recordsToCsv(records: AuditRecord[]) {
  const headers: Array<keyof AuditRecord> = [
    'rowId', 'archive', 'csvRow', 'sourceIssue', 'rawUrl', 'normalizedComparisonUrl',
    'logicalComparisonUrl', 'hasWhitespace', 'malformedReason', 'lastCrawled', 'httpStatus',
    'finalUrl', 'redirectChain', 'redirectLoop', 'externalRedirect', 'canonical', 'canonicals',
    'robotsMeta', 'xRobotsTag', 'noindex', 'standardSitemapMember', 'newsSitemapMember',
    'contentType', 'publishedPublicStatus', 'configuredArticleCanonical', 'proposedAction',
    'articleResolutionEvidence', 'articleReplacementVerified', 'proposedTarget', 'confidence',
    'evidence', 'manualReviewReason', 'processingError',
    'logicalDuplicateRowIds', 'unrelatedManyToOneRedirect', 'detections',
  ];
  const lines = [headers.join(',')];
  for (const record of records) {
    lines.push(
      headers
        .map((header) =>
          csvEscape(header === 'redirectChain' ? JSON.stringify(record.redirectChain) : record[header])
        )
        .join(',')
    );
  }
  return `${lines.join('\r\n')}\r\n`;
}

function parseArgs(argv: string[]): AuditOptions {
  const zipPaths: string[] = [];
  let baseUrl = 'https://lokswami.com';
  let outputDir = '.seo-audit/latest';
  let timeoutMs = 20_000;
  let concurrency = 4;
  let maxRedirects = 10;
  for (const arg of argv) {
    if (arg.startsWith('--zip=')) zipPaths.push(resolve(arg.slice('--zip='.length)));
    else if (arg.startsWith('--base-url=')) baseUrl = arg.slice('--base-url='.length).trim();
    else if (arg.startsWith('--output-dir=')) outputDir = resolve(arg.slice('--output-dir='.length));
    else if (arg.startsWith('--timeout-ms=')) timeoutMs = Number.parseInt(arg.slice('--timeout-ms='.length), 10);
    else if (arg.startsWith('--concurrency=')) concurrency = Number.parseInt(arg.slice('--concurrency='.length), 10);
    else if (arg.startsWith('--max-redirects=')) maxRedirects = Number.parseInt(arg.slice('--max-redirects='.length), 10);
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: npm run audit:seo-indexing -- --zip=<issue.zip> [--zip=<more.zip>] --base-url=https://lokswami.com --output-dir=.seo-audit/2026-08-10');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  invariant(zipPaths.length > 0, 'At least one --zip path is required.');
  baseUrl = normalizeComparisonUrl(baseUrl).replace(/\/+$/, '');
  invariant(Number.isFinite(timeoutMs) && timeoutMs > 0, '--timeout-ms must be positive.');
  invariant(Number.isFinite(concurrency) && concurrency > 0 && concurrency <= 10, '--concurrency must be 1-10.');
  invariant(Number.isFinite(maxRedirects) && maxRedirects >= 0 && maxRedirects <= 20, '--max-redirects must be 0-20.');
  return { baseUrl, zipPaths, outputDir, timeoutMs, concurrency, maxRedirects };
}

export async function runAudit(options: AuditOptions) {
  const parsedArchives = await Promise.all(
    options.zipPaths.map(async (zipPath) => {
      const fileStats = await stat(zipPath);
      invariant(fileStats.isFile(), `${zipPath} is not a file.`);
      invariant(
        fileStats.size <= MAX_ZIP_ARCHIVE_BYTES,
        `${zipPath} exceeds ${MAX_ZIP_ARCHIVE_BYTES} byte ZIP limit.`
      );
      const buffer = await readFile(zipPath);
      return parseGscArchive(buffer, basename(zipPath), options.baseUrl);
    })
  );
  const {
    inventories,
    sourceRows,
    coverage,
    issueTotal,
    exactUniqueUrls,
    perIssue,
  } = reconcileGscArchives(parsedArchives);

  const [standardSitemapResult, newsSitemapResult] = await Promise.all([
    fetchSitemap(options.baseUrl, '/sitemap.xml', options.timeoutMs, options.maxRedirects),
    fetchSitemap(options.baseUrl, '/news-sitemap.xml', options.timeoutMs, options.maxRedirects),
  ]);
  const standardSitemap = new Set(standardSitemapResult.locations);
  const newsSitemap = new Set(newsSitemapResult.locations);

  let completed = 0;
  const inspections = await mapWithConcurrency(sourceRows, options.concurrency, async (row) => {
    const inspection = await inspectPage(
      row,
      options.baseUrl,
      options.timeoutMs,
      options.maxRedirects,
      standardSitemap,
      newsSitemap
    );
    completed += 1;
    if (completed % 25 === 0 || completed === sourceRows.length) {
      console.log(`Inspected ${completed}/${sourceRows.length} input rows.`);
    }
    return inspection;
  });

  const records: AuditRecord[] = sourceRows.map((row, index) => {
    const page = inspections[index];
    const classification = classifyRecord(row, page);
    const detections: string[] = [];
    if (row.malformedReason) detections.push('MALFORMED_OR_WHITESPACE_URL');
    if (page.redirectLoop) detections.push('REDIRECT_LOOP');
    if (page.externalRedirect) detections.push('EXTERNAL_REDIRECT');
    if (page.canonical) {
      const canonicalState = inspectCanonicalUrl(page.canonical, page.finalUrl || row.rawUrl);
      if (canonicalState.invalid) detections.push('INVALID_CANONICAL');
      if (canonicalState.external) detections.push('EXTERNAL_CANONICAL');
    }
    if (uniqueNormalized(page.canonicals).size > 1) detections.push('CONFLICTING_CANONICALS');
    if (!page.canonical && page.httpStatus === 200 && /html/i.test(page.contentTypeHeader)) detections.push('MISSING_CANONICAL');
    if ((page.standardSitemapMember || page.newsSitemapMember) && page.httpStatus !== 200) detections.push('SITEMAP_NON_200');
    if ((page.standardSitemapMember || page.newsSitemapMember) && page.noindex) detections.push('SITEMAP_NOINDEX');
    if ((page.standardSitemapMember || page.newsSitemapMember) && page.publishedPublicStatus === 'not_public') detections.push('UNPUBLISHED_CONTENT_LEAKAGE');
    return {
      ...row,
      ...page,
      ...classification,
      processingError: page.fetchError || row.malformedReason || null,
      logicalDuplicateRowIds: [],
      unrelatedManyToOneRedirect: false,
      detections,
    };
  });
  addCrossRecordDetections(records);
  invariant(records.every((record) => PROPOSED_ACTIONS.includes(record.proposedAction)), 'At least one row lacks a valid classification.');

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: 'strictly-read-only',
    requestMethods: ['GET'],
    baseUrl: options.baseUrl,
    options: { timeoutMs: options.timeoutMs, concurrency: options.concurrency, maxRedirects: options.maxRedirects },
    archives: inventories,
    reconciliation: {
      issueExportRows: sourceRows.length,
      exactUniqueUrls,
      crossIssueExactOverlaps: sourceRows.length - exactUniqueUrls,
      coverageIndexed: coverage.indexed,
      coverageNotIndexed: coverage.notIndexed,
      coverageTotalKnown: coverage.totalKnown,
      coverageLatestDate: coverage.latestDate,
      coverageIssueTotal: issueTotal,
      difference: sourceRows.length - coverage.notIndexed,
      perIssue,
    },
    sitemaps: {
      standard: { url: standardSitemapResult.url, status: standardSitemapResult.status, locations: standardSitemap.size },
      news: { url: newsSitemapResult.url, status: newsSitemapResult.status, locations: newsSitemap.size },
    },
    summary: buildSummary(records),
    records,
  };

  await mkdir(options.outputDir, { recursive: true });
  await writeFile(resolve(options.outputDir, 'seo-indexing-audit.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(resolve(options.outputDir, 'seo-indexing-audit.csv'), recordsToCsv(records), 'utf8');
  await writeFile(
    resolve(options.outputDir, 'seo-indexing-summary.json'),
    `${JSON.stringify({ reconciliation: report.reconciliation, sitemaps: report.sitemaps, summary: report.summary }, null, 2)}\n`,
    'utf8'
  );
  console.log(JSON.stringify({ outputDir: options.outputDir, reconciliation: report.reconciliation, summary: report.summary }, null, 2));
  return report;
}

async function main() {
  await runAudit(parseArgs(process.argv.slice(2)));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`SEO indexing audit failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
