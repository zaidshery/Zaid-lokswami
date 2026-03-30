const DEFAULT_TIMEOUT_MS = 15000;
const ASSET_INTEGRITY_ROUTES = ['/signin', '/main', '/main/epaper'];
const JAVASCRIPT_CONTENT_TYPE_PATTERN =
  /\b(?:application|text)\/(?:javascript|x-javascript|ecmascript)\b/i;
const CSS_CONTENT_TYPE_PATTERN = /\btext\/css\b/i;

function parseArgs(argv) {
  let baseUrl = '';
  let timeoutMs = DEFAULT_TIMEOUT_MS;

  for (const arg of argv) {
    if (!arg) continue;

    if (arg === '--help' || arg === '-h') {
      return { help: true, baseUrl: '', timeoutMs };
    }

    if (arg.startsWith('--baseUrl=')) {
      baseUrl = arg.slice('--baseUrl='.length).trim();
      continue;
    }

    if (arg.startsWith('--timeoutMs=')) {
      const parsed = Number.parseInt(arg.slice('--timeoutMs='.length), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        timeoutMs = parsed;
      }
      continue;
    }

    if (!arg.startsWith('--') && !baseUrl) {
      baseUrl = arg.trim();
    }
  }

  return { help: false, baseUrl, timeoutMs };
}

function normalizeBaseUrl(raw) {
  const fallback =
    process.env.SMOKE_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000';

  const candidate = (raw || fallback).trim();
  if (!candidate) {
    throw new Error('Missing base URL. Pass one as an argument or set NEXT_PUBLIC_SITE_URL.');
  }

  const parsed = new URL(candidate);
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/+$/, '');
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readText(response) {
  return response.text();
}

async function readJson(response) {
  const text = await readText(response);
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON response but received: ${text.slice(0, 200)}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function logPass(message) {
  console.log(`PASS ${message}`);
}

function extractNextStaticAssets(html, pageUrl) {
  const routeUrl = new URL(pageUrl);
  const assets = new Map();
  const attributePattern = /(?:href|src)=["']([^"']+)["']/g;

  for (const match of html.matchAll(attributePattern)) {
    const rawValue = (match[1] || '').trim();
    if (!rawValue || !rawValue.includes('/_next/static/')) {
      continue;
    }

    let assetUrl;
    try {
      assetUrl = new URL(rawValue, routeUrl);
    } catch {
      continue;
    }

    if (assetUrl.origin !== routeUrl.origin) {
      continue;
    }

    const assetPath = `${assetUrl.pathname}${assetUrl.search}`;
    const expectedType = assetUrl.pathname.endsWith('.css')
      ? 'css'
      : assetUrl.pathname.endsWith('.js')
        ? 'javascript'
        : '';

    if (!expectedType) {
      continue;
    }

    assets.set(assetPath, {
      assetPath,
      expectedType,
    });
  }

  return Array.from(assets.values());
}

function matchesExpectedAssetContentType(contentType, expectedType) {
  if (!contentType) {
    return false;
  }

  if (expectedType === 'css') {
    return CSS_CONTENT_TYPE_PATTERN.test(contentType);
  }

  if (expectedType === 'javascript') {
    return JAVASCRIPT_CONTENT_TYPE_PATTERN.test(contentType);
  }

  return false;
}

async function fetchHtmlPage(baseUrl, path, timeoutMs) {
  const url = new URL(path, `${baseUrl}/`).toString();
  const response = await fetchWithTimeout(
    url,
    {
      redirect: 'manual',
      headers: { accept: 'text/html,application/json;q=0.9,*/*;q=0.8' },
    },
    timeoutMs
  );

  assert(response.status === 200, `${path} returned ${response.status} instead of 200`);
  const contentType = response.headers.get('content-type') || '';
  assert(
    /\btext\/html\b/i.test(contentType),
    `${path} returned unexpected content-type ${contentType || '(missing)'}`
  );

  const html = await readText(response);
  logPass(`${path} returned 200 HTML`);
  return { html, url };
}

async function checkHealth(baseUrl, timeoutMs) {
  const url = new URL('/api/health', `${baseUrl}/`).toString();
  const response = await fetchWithTimeout(
    url,
    {
      redirect: 'manual',
      headers: { accept: 'application/json' },
    },
    timeoutMs
  );

  assert(response.status === 200, `/api/health returned ${response.status} instead of 200`);
  const payload = await readJson(response);
  assert(payload && payload.status === 'ok', '/api/health did not return status=ok');
  assert(payload && payload.db === 'connected', '/api/health did not return db=connected');
  logPass('/api/health returned status=ok and db=connected');
}

async function checkAdminRedirect(baseUrl, timeoutMs) {
  const url = new URL('/admin', `${baseUrl}/`).toString();
  const response = await fetchWithTimeout(
    url,
    {
      redirect: 'manual',
      headers: { accept: 'text/html' },
    },
    timeoutMs
  );

  assert(
    [301, 302, 307, 308].includes(response.status),
    `/admin returned ${response.status} instead of a redirect`
  );

  const location = response.headers.get('location') || '';
  assert(
    location.startsWith('/signin?redirect=%2Fadmin'),
    `/admin redirect location was unexpected: ${location || '(missing)'}`
  );

  logPass('/admin redirects guests to /signin?redirect=%2Fadmin');
}

async function checkLatestEpaper(baseUrl, timeoutMs) {
  const url = new URL('/api/epapers/latest?limit=1', `${baseUrl}/`).toString();
  const response = await fetchWithTimeout(
    url,
    {
      redirect: 'manual',
      headers: { accept: 'application/json' },
    },
    timeoutMs
  );

  assert(response.status === 200, `/api/epapers/latest returned ${response.status} instead of 200`);
  const payload = await readJson(response);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  assert(items.length > 0, '/api/epapers/latest returned no items');

  const latest = items[0];
  const latestId = String(latest?._id || '').trim();
  assert(latestId, 'Latest e-paper item is missing an _id');

  logPass(`/api/epapers/latest returned at least one item (${latestId})`);
  return latestId;
}

async function checkLatestEpaperPdf(baseUrl, epaperId, timeoutMs) {
  const url = new URL(`/api/public/epapers/${encodeURIComponent(epaperId)}/pdf`, `${baseUrl}/`).toString();
  const response = await fetchWithTimeout(
    url,
    {
      redirect: 'manual',
      headers: { accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8' },
    },
    timeoutMs
  );

  assert(
    [301, 302, 307, 308].includes(response.status),
    `Latest public e-paper PDF route returned ${response.status} instead of a redirect`
  );

  const location = response.headers.get('location') || '';
  assert(location.startsWith('http'), 'Latest public e-paper PDF route returned no absolute redirect URL');

  logPass(`/api/public/epapers/${epaperId}/pdf returned a redirect`);
}

async function checkAssetIntegrity(baseUrl, routePaths, timeoutMs) {
  const assetReferences = new Map();

  for (const routePath of routePaths) {
    const { html, url } = await fetchHtmlPage(baseUrl, routePath, timeoutMs);
    const assets = extractNextStaticAssets(html, url);

    assert(
      assets.length > 0,
      `${routePath} did not reference any Next.js JS/CSS assets under /_next/static/`
    );

    logPass(`${routePath} referenced ${assets.length} unique Next.js JS/CSS assets`);

    for (const asset of assets) {
      const existing = assetReferences.get(asset.assetPath) || {
        ...asset,
        routes: [],
      };
      existing.routes.push(routePath);
      assetReferences.set(asset.assetPath, existing);
    }
  }

  const failures = [];

  for (const reference of assetReferences.values()) {
    const url = new URL(reference.assetPath, `${baseUrl}/`).toString();
    const response = await fetchWithTimeout(
      url,
      {
        redirect: 'manual',
        headers: { accept: '*/*' },
      },
      timeoutMs
    );

    const contentType = response.headers.get('content-type') || '';

    if (response.status !== 200) {
      failures.push(
        `${reference.routes.join(', ')} -> ${reference.assetPath} returned ${response.status} (${contentType || 'missing content-type'})`
      );
      continue;
    }

    if (!matchesExpectedAssetContentType(contentType, reference.expectedType)) {
      failures.push(
        `${reference.routes.join(', ')} -> ${reference.assetPath} returned content-type ${contentType || '(missing)'} instead of ${reference.expectedType}`
      );
    }
  }

  assert(
    failures.length === 0,
    `Asset integrity check failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`
  );

  logPass(
    `Verified ${assetReferences.size} unique Next.js JS/CSS assets across ${routePaths.length} route(s)`
  );
}

function printHelp() {
  console.log('Usage: npm run test:smoke -- https://your-domain.com');
  console.log('   or: npm run test:smoke -- --baseUrl=https://your-domain.com --timeoutMs=20000');
}

async function main() {
  const { help, baseUrl: baseUrlArg, timeoutMs } = parseArgs(process.argv.slice(2));
  if (help) {
    printHelp();
    return;
  }

  const baseUrl = normalizeBaseUrl(baseUrlArg);
  console.log(`Smoke checking ${baseUrl}`);

  await checkHealth(baseUrl, timeoutMs);
  await checkAssetIntegrity(baseUrl, ASSET_INTEGRITY_ROUTES, timeoutMs);
  await checkAdminRedirect(baseUrl, timeoutMs);

  const latestEpaperId = await checkLatestEpaper(baseUrl, timeoutMs);
  await checkLatestEpaperPdf(baseUrl, latestEpaperId, timeoutMs);

  console.log('Smoke checks passed.');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Smoke checks failed: ${message}`);
  process.exitCode = 1;
});
