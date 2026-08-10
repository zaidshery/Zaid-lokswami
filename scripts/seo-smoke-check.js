const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_CATEGORY_PATH = '/main/category/politics';
const ARTICLE_LOADING_PATTERNS = [/loading article/i, /लेख लोड हो रहा है/i];

function parseArgs(argv) {
  let baseUrl = '';
  let articleUrl = '';
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  let help = false;

  for (const arg of argv) {
    if (!arg) continue;
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }
    if (arg.startsWith('--baseUrl=')) {
      baseUrl = arg.slice('--baseUrl='.length).trim();
      continue;
    }
    if (arg.startsWith('--articleUrl=')) {
      articleUrl = arg.slice('--articleUrl='.length).trim();
      continue;
    }
    if (arg.startsWith('--timeoutMs=')) {
      const parsed = Number.parseInt(arg.slice('--timeoutMs='.length), 10);
      if (Number.isFinite(parsed) && parsed > 0) timeoutMs = parsed;
      continue;
    }
    if (!arg.startsWith('--') && !baseUrl) baseUrl = arg.trim();
  }

  return { help, baseUrl, articleUrl, timeoutMs };
}

function normalizeBaseUrl(raw) {
  const candidate = String(
    raw ||
      process.env.SEO_SMOKE_BASE_URL ||
      process.env.SMOKE_BASE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      DEFAULT_BASE_URL
  ).trim();
  const parsed = new URL(candidate);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('SEO smoke base URL must use http or https.');
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/+$/, '');
}

function resolveConfiguredArticleUrl(baseUrl, rawArticleUrl) {
  const configured = String(rawArticleUrl || process.env.SEO_SMOKE_ARTICLE_URL || '').trim();
  if (!configured) return null;

  const base = new URL(baseUrl);
  const article = new URL(configured, `${baseUrl}/`);
  if (article.origin !== base.origin) {
    throw new Error('SEO smoke article URL must use the same origin as the base URL.');
  }
  return article.toString();
}

function getPublicArticleItems(payload) {
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function getPublicArticleDetail(payload) {
  const candidates = [
    payload?.data?.article,
    payload?.data,
    payload?.article,
    payload?.item,
  ];
  return (
    candidates.find(
      (candidate) => candidate && typeof candidate === 'object' && !Array.isArray(candidate)
    ) || null
  );
}

function extractHtmlAttributes(tag) {
  const attributes = {};
  const pattern = /([:\w-]+)\s*=\s*(["'])(.*?)\2/g;
  for (const match of tag.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = match[3];
  }
  return attributes;
}

function extractCanonicalHref(html) {
  for (const match of String(html || '').matchAll(/<link\b[^>]*>/gi)) {
    const attributes = extractHtmlAttributes(match[0]);
    const relTokens = String(attributes.rel || '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (relTokens.includes('canonical') && attributes.href) return attributes.href;
  }
  return '';
}

function visibleTextFromHtml(html) {
  return String(html || '')
    .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyArticleHtml(html) {
  const source = String(html || '');
  const visibleText = visibleTextFromHtml(source);
  const h1Matches = Array.from(source.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi));
  const hasHeadline = h1Matches.some((match) => visibleTextFromHtml(match[1]).length >= 8);
  const paragraphMatches = Array.from(source.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi));
  const substantialParagraphs = paragraphMatches
    .map((match) => visibleTextFromHtml(match[1]))
    .filter((text) => text.length >= 80);
  const hasBodyMarker = /<article\b|data-article-body(?:\s*=|\s|>)/i.test(source);
  const hasBody = hasBodyMarker && substantialParagraphs.length > 0;
  const hasLoadingPlaceholder = ARTICLE_LOADING_PATTERNS.some((pattern) => pattern.test(visibleText));
  const issues = [];

  if (!hasHeadline) issues.push('initial HTML has no substantive H1');
  if (!hasBody) issues.push('initial HTML has no marked article body with a substantive paragraph');
  if (hasLoadingPlaceholder) issues.push('initial HTML still contains the article loading placeholder');

  return {
    ready: issues.length === 0,
    hasHeadline,
    hasBody,
    hasLoadingPlaceholder,
    substantialParagraphCount: substantialParagraphs.length,
    issues,
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function logPass(message) {
  console.log(`PASS ${message}`);
}

async function fetchTextWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    return { response, text };
  } catch (error) {
    if (timedOut) {
      throw new Error(
        `${url} timed out after ${timeoutMs}ms while reading response headers or body.`,
        { cause: error }
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTextRoute(baseUrl, pathOrUrl, accept, timeoutMs) {
  const requestedUrl = new URL(pathOrUrl, `${baseUrl}/`).toString();
  const { response, text } = await fetchTextWithTimeout(
    requestedUrl,
    { redirect: 'follow', headers: { accept } },
    timeoutMs
  );
  const url = response.url || requestedUrl;
  assert(response.status === 200, `${url} returned ${response.status} instead of 200`);
  return { response, text, url, requestedUrl };
}

function normalizeCanonicalComparisonUrl(value) {
  const url = new URL(value);
  url.hash = '';
  url.pathname = url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '') || '/';
  return url;
}

function assertCanonicalMatchesExpected(
  canonicalHref,
  pageUrl,
  expectedCanonicalUrl,
  expectedOrigin
) {
  const page = normalizeCanonicalComparisonUrl(pageUrl);
  const canonical = normalizeCanonicalComparisonUrl(new URL(canonicalHref, page).toString());
  const expected = normalizeCanonicalComparisonUrl(expectedCanonicalUrl);
  const deploymentOrigin = new URL(expectedOrigin).origin;

  assert(page.origin === deploymentOrigin, `${pageUrl} redirected to another origin`);
  assert(canonical.origin === deploymentOrigin, `${pageUrl} canonical uses another origin`);
  assert(
    expected.origin === deploymentOrigin,
    `${pageUrl} expected canonical uses an unsupported origin`
  );
  assert(
    canonical.toString() === expected.toString(),
    `${pageUrl} canonical ${canonical.toString()} does not match the checked page URL expectation ${expected.toString()}`
  );

  return canonical;
}

function assertCanonicalMatchesPage(canonicalHref, pageUrl, expectedOrigin) {
  return assertCanonicalMatchesExpected(canonicalHref, pageUrl, pageUrl, expectedOrigin);
}

function resolveSupportedArticleCanonical(baseUrl, rawCanonicalUrl) {
  const configured = typeof rawCanonicalUrl === 'string' ? rawCanonicalUrl.trim() : '';
  if (!configured) return '';

  let canonical;
  try {
    canonical = new URL(configured);
  } catch {
    throw new Error('Configured article canonical override must be a valid absolute HTTP(S) URL.');
  }

  assert(
    canonical.protocol === 'http:' || canonical.protocol === 'https:',
    'Configured article canonical override must be a valid absolute HTTP(S) URL.'
  );
  assert(
    canonical.origin === new URL(baseUrl).origin,
    'Configured article canonical override uses an unsupported origin.'
  );
  return canonical.toString();
}

async function checkRobots(baseUrl, timeoutMs) {
  const { response, text } = await fetchTextRoute(baseUrl, '/robots.txt', 'text/plain', timeoutMs);
  const contentType = response.headers.get('content-type') || '';
  assert(/text\/plain/i.test(contentType), `/robots.txt returned ${contentType || 'no content type'}`);
  assert(/user-agent\s*:/i.test(text), '/robots.txt has no User-agent directive');
  assert(text.includes(`${baseUrl}/sitemap.xml`), '/robots.txt does not advertise the standard sitemap');
  assert(text.includes(`${baseUrl}/news-sitemap.xml`), '/robots.txt does not advertise the news sitemap');
  logPass('/robots.txt is fetchable and advertises both sitemaps');
}

async function checkSitemap(baseUrl, path, options, timeoutMs) {
  const { response, text } = await fetchTextRoute(baseUrl, path, 'application/xml,text/xml', timeoutMs);
  const contentType = response.headers.get('content-type') || '';
  assert(/xml/i.test(contentType), `${path} returned ${contentType || 'no content type'}`);
  assert(/<(?:urlset|sitemapindex)\b/i.test(text), `${path} has no sitemap XML root`);
  if (options.requireNewsNamespace) {
    assert(/xmlns:news=/i.test(text), `${path} has no Google News namespace`);
  }
  logPass(`${path} is fetchable XML`);
}

async function checkCanonicalHtml(baseUrl, path, timeoutMs, expectedCanonicalUrl = '') {
  const { response, text, url } = await fetchTextRoute(baseUrl, path, 'text/html', timeoutMs);
  const contentType = response.headers.get('content-type') || '';
  assert(/text\/html/i.test(contentType), `${path} returned ${contentType || 'no content type'}`);
  const canonical = extractCanonicalHref(text);
  assert(canonical, `${path} has no canonical link in initial HTML`);
  const expected = expectedCanonicalUrl || url;
  const resolvedCanonical = assertCanonicalMatchesExpected(canonical, url, expected, baseUrl);
  logPass(`${path} returned HTML with the expected canonical`);
  return { text, url, canonical: resolvedCanonical.toString() };
}

function getArticleTokenFromUrl(articleUrl) {
  const match = new URL(articleUrl).pathname.match(/^\/main\/article\/([^/]+)\/?$/i);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

async function fetchArticleCanonicalOverride(baseUrl, token, timeoutMs) {
  if (!token) return '';
  const { response, text } = await fetchTextRoute(
    baseUrl,
    `/api/v1/public/articles/${encodeURIComponent(token)}`,
    'application/json',
    timeoutMs
  );
  const contentType = response.headers.get('content-type') || '';
  assert(/json/i.test(contentType), `Public article detail returned ${contentType || 'no content type'}`);

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('Public article detail did not return valid JSON.');
  }

  const article = getPublicArticleDetail(payload);
  assert(article, 'Public article detail returned no article metadata.');
  const seo = article.seo && typeof article.seo === 'object' ? article.seo : {};
  return resolveSupportedArticleCanonical(baseUrl, seo.canonicalUrl);
}

async function discoverArticleTarget(baseUrl, configuredArticleUrl, timeoutMs) {
  const configured = resolveConfiguredArticleUrl(baseUrl, configuredArticleUrl);
  if (configured) {
    return {
      url: configured,
      expectedCanonicalUrl: await fetchArticleCanonicalOverride(
        baseUrl,
        getArticleTokenFromUrl(configured),
        timeoutMs
      ),
    };
  }

  const { response, text } = await fetchTextRoute(
    baseUrl,
    '/api/v1/public/articles?limit=5',
    'application/json',
    timeoutMs
  );
  const contentType = response.headers.get('content-type') || '';
  assert(/json/i.test(contentType), `Public article feed returned ${contentType || 'no content type'}`);

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('Public article feed did not return valid JSON.');
  }

  const article = getPublicArticleItems(payload).find((item) => item && (item.slug || item._id || item.id));
  assert(article, 'Public article feed returned no article that can be smoke tested.');
  const token = String(article.slug || article._id || article.id).trim();
  return {
    url: new URL(`/main/article/${encodeURIComponent(token)}`, `${baseUrl}/`).toString(),
    expectedCanonicalUrl: await fetchArticleCanonicalOverride(baseUrl, token, timeoutMs),
  };
}

async function checkArticleHtml(baseUrl, configuredArticleUrl, timeoutMs) {
  const target = await discoverArticleTarget(baseUrl, configuredArticleUrl, timeoutMs);
  const article = await checkCanonicalHtml(
    baseUrl,
    target.url,
    timeoutMs,
    target.expectedCanonicalUrl
  );
  const assessment = classifyArticleHtml(article.text);
  assert(
    assessment.ready,
    `Known Phase 2 article SSR gap at ${target.url}: ${assessment.issues.join('; ')}`
  );
  logPass(`Article initial HTML contains a substantive H1 and server-rendered body (${target.url})`);
}

function printHelp() {
  console.log('Usage: npm run test:seo-smoke -- https://your-domain.com');
  console.log(
    '   or: npm run test:seo-smoke -- --baseUrl=https://your-domain.com --articleUrl=/main/article/example --timeoutMs=20000'
  );
  console.log('If articleUrl is omitted, the script selects one item from the public article feed.');
}

async function runSeoSmoke(options) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  console.log(`SEO smoke checking ${baseUrl}`);
  await checkRobots(baseUrl, options.timeoutMs);
  await checkSitemap(baseUrl, '/sitemap.xml', { requireNewsNamespace: false }, options.timeoutMs);
  await checkSitemap(baseUrl, '/news-sitemap.xml', { requireNewsNamespace: true }, options.timeoutMs);
  await checkCanonicalHtml(baseUrl, '/main', options.timeoutMs);
  await checkCanonicalHtml(baseUrl, DEFAULT_CATEGORY_PATH, options.timeoutMs);
  await checkCanonicalHtml(baseUrl, '/main/epaper', options.timeoutMs);
  await checkArticleHtml(baseUrl, options.articleUrl, options.timeoutMs);
  console.log('SEO smoke checks passed.');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  await runSeoSmoke(options);
}

if (require.main === module) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SEO smoke checks failed: ${message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  assertCanonicalMatchesExpected,
  assertCanonicalMatchesPage,
  checkArticleHtml,
  checkCanonicalHtml,
  classifyArticleHtml,
  extractCanonicalHref,
  fetchTextRoute,
  getPublicArticleDetail,
  getPublicArticleItems,
  normalizeBaseUrl,
  parseArgs,
  resolveConfiguredArticleUrl,
  resolveSupportedArticleCanonical,
  runSeoSmoke,
};
