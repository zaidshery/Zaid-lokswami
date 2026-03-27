const DEFAULT_TIMEOUT_MS = 15000;

const ADMIN_PAGE_PATHS = [
  '/admin',
  '/admin/articles',
  '/admin/videos',
  '/admin/stories',
  '/admin/epapers',
  '/admin/media',
  '/admin/categories',
];

const ADMIN_API_PATHS = [
  { path: '/api/admin/articles', expectedStatus: 401, expectedError: 'Unauthorized' },
  { path: '/api/admin/videos', expectedStatus: 401, expectedError: 'Unauthorized' },
  { path: '/api/admin/stories', expectedStatus: 401, expectedError: 'Unauthorized' },
  { path: '/api/admin/epapers', expectedStatus: 401, expectedError: 'Unauthorized' },
  { path: '/api/admin/media', expectedStatus: 401, expectedError: 'Unauthorized' },
  { path: '/api/admin/categories', expectedStatus: 401, expectedError: 'Unauthorized' },
  { path: '/api/admin/team', expectedStatus: 403, expectedError: 'Forbidden' },
  { path: '/api/admin/contact-messages', expectedStatus: 401, expectedError: 'Unauthorized' },
];

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
    process.env.ADMIN_RUNTIME_BASE_URL ||
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

async function readJson(response) {
  const text = await response.text();
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

function getExpectedSigninRedirect(path) {
  return `/signin?redirect=${encodeURIComponent(path)}`;
}

async function checkGuestPageRedirect(baseUrl, path, timeoutMs) {
  const url = new URL(path, `${baseUrl}/`).toString();
  const response = await fetchWithTimeout(
    url,
    {
      redirect: 'manual',
      headers: { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' },
    },
    timeoutMs
  );

  assert(
    [301, 302, 307, 308].includes(response.status),
    `${path} returned ${response.status} instead of a redirect`
  );

  const location = response.headers.get('location') || '';
  const expectedLocation = getExpectedSigninRedirect(path);

  assert(
    location.startsWith(expectedLocation),
    `${path} redirect location was unexpected: ${location || '(missing)'}`
  );

  logPass(`${path} redirects guests to ${expectedLocation}`);
}

async function checkGuestApiUnauthorized(baseUrl, check, timeoutMs) {
  const url = new URL(check.path, `${baseUrl}/`).toString();
  const response = await fetchWithTimeout(
    url,
    {
      redirect: 'manual',
      headers: { accept: 'application/json' },
    },
    timeoutMs
  );

  assert(
    response.status === check.expectedStatus,
    `${check.path} returned ${response.status} instead of ${check.expectedStatus}`
  );
  const payload = await readJson(response);
  assert(payload?.success === false, `${check.path} did not return success=false`);
  assert(
    payload?.error === check.expectedError,
    `${check.path} did not return error=${check.expectedError}`
  );

  logPass(`${check.path} returns ${check.expectedStatus} ${check.expectedError} for guests`);
}

function printHelp() {
  console.log('Usage: npm run test:admin-runtime -- https://your-domain.com');
  console.log('   or: npm run test:admin-runtime -- --baseUrl=https://your-domain.com --timeoutMs=20000');
}

async function main() {
  const { help, baseUrl: baseUrlArg, timeoutMs } = parseArgs(process.argv.slice(2));
  if (help) {
    printHelp();
    return;
  }

  const baseUrl = normalizeBaseUrl(baseUrlArg);
  console.log(`Admin runtime guest-boundary checking ${baseUrl}`);
  let failures = 0;

  for (const path of ADMIN_PAGE_PATHS) {
    try {
      await checkGuestPageRedirect(baseUrl, path, timeoutMs);
    } catch (error) {
      failures += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`FAIL ${message}`);
    }
  }

  for (const check of ADMIN_API_PATHS) {
    try {
      await checkGuestApiUnauthorized(baseUrl, check, timeoutMs);
    } catch (error) {
      failures += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`FAIL ${message}`);
    }
  }

  if (failures > 0) {
    throw new Error(`${failures} admin runtime check(s) failed`);
  }

  console.log('Admin runtime guest-boundary checks passed.');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Admin runtime checks failed: ${message}`);
  process.exitCode = 1;
});
