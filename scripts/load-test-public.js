const DEFAULT_DURATION_SEC = 20;
const DEFAULT_CONCURRENCY = 20;
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_ROUTES = [
  { path: '/', accept: 'text/html' },
  { path: '/main', accept: 'text/html' },
  { path: '/main/latest', accept: 'text/html' },
  { path: '/main/epaper', accept: 'text/html' },
  { path: '/api/v1/public/home-feed', accept: 'application/json' },
  { path: '/api/v1/public/articles?limit=10', accept: 'application/json' },
  { path: '/api/v1/public/epapers?limit=10', accept: 'application/json' },
  { path: '/api/videos/latest?limit=6', accept: 'application/json' },
  { path: '/api/stories/latest?limit=6', accept: 'application/json' },
  { path: '/api/v1/public/search?q=indore&limit=10', accept: 'application/json' },
];

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseArgs(argv) {
  const routes = [];
  let baseUrl = '';
  let durationSec = DEFAULT_DURATION_SEC;
  let concurrency = DEFAULT_CONCURRENCY;
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  let help = false;

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }

    if (arg.startsWith('--baseUrl=')) {
      baseUrl = arg.slice('--baseUrl='.length).trim();
      continue;
    }

    if (arg.startsWith('--durationSec=')) {
      durationSec = parsePositiveInt(arg.slice('--durationSec='.length), durationSec);
      continue;
    }

    if (arg.startsWith('--concurrency=')) {
      concurrency = parsePositiveInt(arg.slice('--concurrency='.length), concurrency);
      continue;
    }

    if (arg.startsWith('--timeoutMs=')) {
      timeoutMs = parsePositiveInt(arg.slice('--timeoutMs='.length), timeoutMs);
      continue;
    }

    if (arg.startsWith('--route=')) {
      const path = arg.slice('--route='.length).trim();
      if (path) routes.push({ path, accept: 'text/html,application/json;q=0.9,*/*;q=0.8' });
      continue;
    }

    if (!arg.startsWith('--') && !baseUrl) {
      baseUrl = arg.trim();
    }
  }

  return {
    help,
    baseUrl,
    durationSec,
    concurrency,
    timeoutMs,
    routes: routes.length ? routes : DEFAULT_ROUTES,
  };
}

function normalizeBaseUrl(raw) {
  const fallback =
    process.env.LOAD_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000';
  const candidate = (raw || fallback).trim();
  if (!candidate) throw new Error('Missing base URL.');

  const parsed = new URL(candidate);
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/+$/, '');
}

async function fetchWithTimeout(url, route, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();

  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        accept: route.accept,
        'user-agent': 'lokswami-public-load-test/1.0',
      },
    });
    await response.arrayBuffer();
    return {
      route: route.path,
      status: response.status,
      durationMs: performance.now() - startedAt,
      error: '',
    };
  } catch (error) {
    return {
      route: route.path,
      status: 0,
      durationMs: performance.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

function percentile(values, percent) {
  if (!values.length) return 0;
  const index = Math.min(
    values.length - 1,
    Math.max(0, Math.ceil((percent / 100) * values.length) - 1)
  );
  return values[index];
}

function formatMs(value) {
  return `${Math.round(value)}ms`;
}

function printHelp() {
  console.log('Usage: npm run load:test:public -- https://lokswami.com');
  console.log('   or: npm run load:test:public -- --baseUrl=https://lokswami.com --durationSec=30 --concurrency=50');
  console.log('   optional: repeat --route=/path to test a custom route set');
}

async function main() {
  const { help, baseUrl: baseUrlArg, durationSec, concurrency, timeoutMs, routes } = parseArgs(
    process.argv.slice(2)
  );
  if (help) {
    printHelp();
    return;
  }

  const baseUrl = normalizeBaseUrl(baseUrlArg);
  const deadline = Date.now() + durationSec * 1000;
  const results = [];
  let nextRequestIndex = 0;

  console.log(
    `Load testing ${baseUrl} for ${durationSec}s at concurrency ${concurrency} across ${routes.length} route(s)`
  );

  async function worker() {
    while (Date.now() < deadline) {
      const requestIndex = nextRequestIndex;
      nextRequestIndex += 1;
      const route = routes[requestIndex % routes.length];
      const url = new URL(route.path, `${baseUrl}/`).toString();
      results.push(await fetchWithTimeout(url, route, timeoutMs));
    }
  }

  const startedAt = Date.now();
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const elapsedSec = Math.max(0.001, (Date.now() - startedAt) / 1000);

  const durations = results.map((item) => item.durationMs).sort((a, b) => a - b);
  const ok = results.filter((item) => item.status >= 200 && item.status < 400).length;
  const errors = results.length - ok;
  const statusCounts = new Map();
  const routeCounts = new Map();
  const errorSamples = [];

  for (const result of results) {
    statusCounts.set(result.status, (statusCounts.get(result.status) || 0) + 1);
    const routeStat = routeCounts.get(result.route) || { total: 0, errors: 0 };
    routeStat.total += 1;
    if (!(result.status >= 200 && result.status < 400)) routeStat.errors += 1;
    routeCounts.set(result.route, routeStat);
    if (result.error && errorSamples.length < 5) errorSamples.push(`${result.route}: ${result.error}`);
  }

  console.log('');
  console.log('Summary');
  console.log(`Requests: ${results.length}`);
  console.log(`OK: ${ok}`);
  console.log(`Errors: ${errors}`);
  console.log(`RPS: ${(results.length / elapsedSec).toFixed(2)}`);
  console.log(`Avg: ${formatMs(durations.reduce((sum, value) => sum + value, 0) / Math.max(1, durations.length))}`);
  console.log(`P50: ${formatMs(percentile(durations, 50))}`);
  console.log(`P95: ${formatMs(percentile(durations, 95))}`);
  console.log(`P99: ${formatMs(percentile(durations, 99))}`);
  console.log(`Status: ${Array.from(statusCounts.entries()).map(([status, count]) => `${status}:${count}`).join(', ')}`);
  console.log('');
  console.log('Routes');
  for (const [route, stat] of routeCounts.entries()) {
    console.log(`${route} total=${stat.total} errors=${stat.errors}`);
  }

  if (errorSamples.length) {
    console.log('');
    console.log('Error samples');
    for (const sample of errorSamples) console.log(sample);
  }

  const errorRate = results.length ? errors / results.length : 1;
  if (errorRate > 0.02) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
