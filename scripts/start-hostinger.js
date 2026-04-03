const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const {
  DEFAULT_RELEASE_RETENTION,
  dedupeStrings,
  exists,
  getReleaseDir,
  getReleaseServerEntry,
  getReleaseStaticDir,
  projectRoot,
  pruneDirectories,
  readReleaseState,
  releasesDir,
  resolvePositiveInteger,
  sharedStaticDir,
  writeReleaseState,
} = require('./hostinger-release-utils');

const STARTUP_TIMEOUT_MS = 60_000;
const STATIC_ASSET_PREFIXES = ['/_next/static/', '/next/static/', '/__next_static__/'];
const STATIC_CACHE_CONTROL = 'public, max-age=31536000, immutable';

function clearMissingManagedRelease(releaseState, missingReleaseId) {
  const nextState = {
    ...releaseState,
    currentReleaseId:
      releaseState.currentReleaseId === missingReleaseId
        ? ''
        : releaseState.currentReleaseId,
    pendingReleaseId:
      releaseState.pendingReleaseId === missingReleaseId
        ? ''
        : releaseState.pendingReleaseId,
    releaseHistoryIds: releaseState.releaseHistoryIds.filter(
      (releaseId) => releaseId !== missingReleaseId
    ),
  };

  writeReleaseState(nextState);
  return nextState;
}

function loadProjectEnvFiles() {
  let dotenv;

  try {
    dotenv = require('dotenv');
  } catch {
    return;
  }

  const mode = (process.env.NODE_ENV || 'production').trim() || 'production';
  const envFileNames = [
    '.env',
    `.env.${mode}`,
    '.env.local',
    `.env.${mode}.local`,
  ];

  for (const fileName of envFileNames) {
    const envPath = path.join(projectRoot, fileName);
    if (!exists(envPath)) {
      continue;
    }

    dotenv.config({
      path: envPath,
      override: false,
    });
  }
}

function promotePreparedRelease(releaseState) {
  const nextReleaseId =
    releaseState.pendingReleaseId || releaseState.currentReleaseId;

  if (!nextReleaseId) {
    return { releaseId: '', releaseState };
  }

  const nextServerEntry = getReleaseServerEntry(nextReleaseId);
  if (!exists(nextServerEntry)) {
    throw new Error(`Prepared Hostinger release is missing server.js: ${nextServerEntry}`);
  }

  const historyLimit = resolvePositiveInteger(
    process.env.HOSTINGER_RELEASE_RETENTION,
    DEFAULT_RELEASE_RETENTION
  );
  const nextHistoryIds = dedupeStrings([
    nextReleaseId,
    releaseState.currentReleaseId,
    ...releaseState.releaseHistoryIds,
  ]).slice(0, historyLimit);

  const nextState = {
    ...releaseState,
    currentReleaseId: nextReleaseId,
    pendingReleaseId: '',
    releaseHistoryIds: nextHistoryIds,
    lastStartedAt: new Date().toISOString(),
  };

  writeReleaseState(nextState);

  const removedReleaseIds = pruneDirectories(releasesDir, nextHistoryIds);
  if (removedReleaseIds.length > 0) {
    console.log(
      `Pruned old Hostinger releases: ${removedReleaseIds.join(', ')}`
    );
  }

  return { releaseId: nextReleaseId, releaseState: nextState };
}

function resolveServerEntry() {
  let releaseState = readReleaseState();

  if (releaseState.pendingReleaseId || releaseState.currentReleaseId) {
    const managedReleaseId =
      releaseState.pendingReleaseId || releaseState.currentReleaseId;
    const managedServerEntry = getReleaseServerEntry(managedReleaseId);

    if (!exists(managedServerEntry)) {
      console.warn(
        [
          `Managed Hostinger release ${managedReleaseId} is missing at startup.`,
          `Expected server entry: ${managedServerEntry}`,
          'Clearing the stale release pointer and requiring a fresh managed release.',
        ].join('\n')
      );
      releaseState = clearMissingManagedRelease(releaseState, managedReleaseId);
    } else {
      const { releaseId } = promotePreparedRelease(releaseState);
      if (releaseId) {
        return {
          releaseId,
          serverEntry: getReleaseServerEntry(releaseId),
        };
      }
    }
  }

  throw new Error(
    'No prepared Hostinger release was found. Run `npm run build:hostinger` first.'
  );
}

function resolveStaticRoot(releaseId) {
  if (exists(sharedStaticDir)) {
    return sharedStaticDir;
  }

  return getReleaseStaticDir(releaseId);
}

function isStaticAssetRequest(requestUrl) {
  if (!requestUrl) {
    return false;
  }

  return STATIC_ASSET_PREFIXES.some((prefix) => requestUrl.startsWith(prefix));
}

function normalizeStaticRelativePath(requestUrl) {
  let pathname = '';

  try {
    pathname = new URL(requestUrl, 'http://127.0.0.1').pathname;
  } catch {
    return '';
  }

  const prefix = STATIC_ASSET_PREFIXES.find((candidate) =>
    pathname.startsWith(candidate)
  );
  if (!prefix) {
    return '';
  }

  const relativePath = pathname.slice(prefix.length).replace(/^\/+/, '');
  const normalizedPath = relativePath.startsWith('static/')
    ? relativePath.slice('static/'.length)
    : relativePath;

  if (!normalizedPath || normalizedPath.includes('\0')) {
    return '';
  }

  const safePath = path.posix.normalize(normalizedPath);
  if (
    safePath.startsWith('..') ||
    safePath.includes('../') ||
    path.posix.isAbsolute(safePath)
  ) {
    return '';
  }

  return safePath;
}

function getContentType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.js':
    case '.mjs':
      return 'application/javascript; charset=UTF-8';
    case '.css':
      return 'text/css; charset=UTF-8';
    case '.json':
    case '.map':
      return 'application/json; charset=UTF-8';
    case '.txt':
      return 'text/plain; charset=UTF-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.avif':
      return 'image/avif';
    case '.ico':
      return 'image/x-icon';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    case '.ttf':
      return 'font/ttf';
    case '.otf':
      return 'font/otf';
    case '.webmanifest':
      return 'application/manifest+json; charset=UTF-8';
    default:
      return 'application/octet-stream';
  }
}

function serveStaticAsset(req, res, staticRoot) {
  const relativePath = normalizeStaticRelativePath(req.url || '');
  if (!relativePath || !staticRoot || !exists(staticRoot)) {
    return false;
  }

  const assetPath = path.join(staticRoot, ...relativePath.split('/'));
  if (!exists(assetPath)) {
    return false;
  }

  let stats;
  try {
    stats = fs.statSync(assetPath);
  } catch {
    return false;
  }

  if (!stats.isFile()) {
    return false;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', getContentType(assetPath));
  res.setHeader('Cache-Control', STATIC_CACHE_CONTROL);
  res.setHeader('Content-Length', String(stats.size));
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'HEAD') {
    res.end();
    return true;
  }

  const stream = fs.createReadStream(assetPath);
  stream.on('error', (error) => {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    }
    res.end('Failed to read static asset.');
    console.error('Failed to stream shared static asset:', error);
  });
  stream.pipe(res);
  return true;
}

function proxyRequest(req, res, internalPort) {
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port: internalPort,
      method: req.method,
      path: req.url,
      headers: req.headers,
    },
    (upstreamRes) => {
      res.writeHead(
        upstreamRes.statusCode || 502,
        upstreamRes.statusMessage || '',
        upstreamRes.headers
      );
      upstreamRes.pipe(res);
    }
  );

  upstream.on('error', (error) => {
    if (!res.headersSent) {
      res.writeHead(502, {
        'Content-Type': 'text/plain; charset=UTF-8',
      });
    }
    res.end('Upstream Next.js server unavailable.');
    console.error('Failed to proxy request to Hostinger release:', error);
  });

  req.pipe(upstream);
}

function waitForInternalServer(port, timeoutMs) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.connect({ host: '127.0.0.1', port });

      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });

      socket.once('error', () => {
        socket.destroy();

        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for release server on port ${port}.`));
          return;
        }

        setTimeout(tryConnect, 250);
      });
    };

    tryConnect();
  });
}

function reserveEphemeralPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port =
        address && typeof address === 'object' ? address.port : 0;

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        if (!port) {
          reject(new Error('Unable to reserve an internal port for Hostinger proxy.'));
          return;
        }

        resolve(port);
      });
    });
  });
}

async function main() {
  loadProjectEnvFiles();
  const target = resolveServerEntry();
  const releaseRoot = getReleaseDir(target.releaseId);
  const staticRoot = resolveStaticRoot(target.releaseId);
  const publicPort = parseInt(process.env.PORT, 10) || 3000;
  const internalPort = await reserveEphemeralPort();

  console.log(
    `Starting Hostinger release ${target.releaseId} from ${releaseRoot}`
  );
  if (staticRoot && exists(staticRoot)) {
    console.log(`Shared static root: ${staticRoot}`);
  }

  const child = spawn(process.execPath, [target.serverEntry], {
    cwd: releaseRoot,
    env: {
      ...process.env,
      HOSTNAME: '127.0.0.1',
      PORT: String(internalPort),
    },
    stdio: 'inherit',
  });

  await waitForInternalServer(internalPort, STARTUP_TIMEOUT_MS);

  const proxyServer = http.createServer((req, res) => {
    if (isStaticAssetRequest(req.url || '') && serveStaticAsset(req, res, staticRoot)) {
      return;
    }

    proxyRequest(req, res, internalPort);
  });

  await new Promise((resolve, reject) => {
    proxyServer.once('error', reject);
    proxyServer.listen(publicPort, '0.0.0.0', resolve);
  });

  console.log(
    `Hostinger proxy listening on port ${publicPort} and forwarding to internal port ${internalPort}`
  );

  const forwardSignal = (signal) => {
    proxyServer.close();
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', forwardSignal);
  process.on('SIGTERM', forwardSignal);

  child.on('exit', (code, signal) => {
    proxyServer.close();
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on('error', (error) => {
    proxyServer.close();
    console.error('Failed to start Hostinger release:', error);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error('Failed to start Hostinger proxy:', error);
  process.exit(1);
});
