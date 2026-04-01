const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const hostingerRoot = path.join(projectRoot, '.hostinger');
const releasesDir = path.join(hostingerRoot, 'releases');
const staticSnapshotsDir = path.join(hostingerRoot, 'static-snapshots');
const releaseStatePath = path.join(hostingerRoot, 'release-state.json');
// Keep a wider overlap window so older browser tabs can still load hashed
// assets while users refresh onto the newest release after deploys.
const DEFAULT_STATIC_OVERLAP_RELEASES = 7;
const DEFAULT_RELEASE_RETENTION = 10;

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function exists(targetPath) {
  return fs.existsSync(targetPath);
}

function ensureExists(targetPath, label) {
  if (!exists(targetPath)) {
    throw new Error(`${label} not found: ${targetPath}`);
  }
}

function sanitizeReleaseId(value) {
  const sanitized = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (sanitized) {
    return sanitized;
  }

  return `release-${new Date().toISOString().replace(/[:.]/g, '-')}`;
}

function readText(targetPath) {
  return fs.readFileSync(targetPath, 'utf8');
}

function readJson(targetPath, fallbackValue) {
  if (!exists(targetPath)) {
    return fallbackValue;
  }

  return JSON.parse(readText(targetPath));
}

function writeJsonAtomic(targetPath, value) {
  ensureDir(path.dirname(targetPath));
  const tempPath = `${targetPath}.tmp-${process.pid}`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, targetPath);
}

function dedupeStrings(values) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    )
  );
}

function normalizeReleaseState(rawValue) {
  const value =
    rawValue && typeof rawValue === 'object' ? rawValue : {};

  return {
    version: 1,
    currentReleaseId:
      typeof value.currentReleaseId === 'string' ? value.currentReleaseId.trim() : '',
    pendingReleaseId:
      typeof value.pendingReleaseId === 'string' ? value.pendingReleaseId.trim() : '',
    releaseHistoryIds: dedupeStrings(
      Array.isArray(value.releaseHistoryIds) ? value.releaseHistoryIds : []
    ),
    lastPreparedAt:
      typeof value.lastPreparedAt === 'string' ? value.lastPreparedAt.trim() : '',
    lastStartedAt:
      typeof value.lastStartedAt === 'string' ? value.lastStartedAt.trim() : '',
  };
}

function readReleaseState() {
  return normalizeReleaseState(readJson(releaseStatePath, {}));
}

function writeReleaseState(nextState) {
  writeJsonAtomic(releaseStatePath, normalizeReleaseState(nextState));
}

function resolvePositiveInteger(value, fallbackValue, minimum = 1) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallbackValue;
}

function getReleaseIdFromBuild(nextDir) {
  const buildIdPath = path.join(nextDir, 'BUILD_ID');
  const buildId = exists(buildIdPath) ? readText(buildIdPath).trim() : '';
  return sanitizeReleaseId(buildId);
}

function listDirectories(targetDir) {
  if (!exists(targetDir)) {
    return [];
  }

  return fs
    .readdirSync(targetDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function sortDirectoryNamesByMtime(targetDir, names) {
  return [...names].sort((left, right) => {
    const leftPath = path.join(targetDir, left);
    const rightPath = path.join(targetDir, right);
    const leftMtime = fs.statSync(leftPath).mtimeMs;
    const rightMtime = fs.statSync(rightPath).mtimeMs;

    if (rightMtime !== leftMtime) {
      return rightMtime - leftMtime;
    }

    return left.localeCompare(right);
  });
}

function removeDirectory(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function copyDirectory(sourceDir, targetDir) {
  if (!exists(sourceDir)) {
    return;
  }

  ensureDir(path.dirname(targetDir));
  removeDirectory(targetDir);
  fs.cpSync(sourceDir, targetDir, { recursive: true });
}

function mergeDirectory(sourceDir, targetDir, options = {}) {
  const overwrite = options.overwrite === true;

  if (!exists(sourceDir)) {
    return 0;
  }

  ensureDir(targetDir);
  let copiedFiles = 0;

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copiedFiles += mergeDirectory(sourcePath, targetPath, options);
      continue;
    }

    ensureDir(path.dirname(targetPath));
    if (!overwrite && exists(targetPath)) {
      continue;
    }

    fs.copyFileSync(sourcePath, targetPath);
    copiedFiles += 1;
  }

  return copiedFiles;
}

function getReleaseDir(releaseId) {
  return path.join(releasesDir, releaseId);
}

function getReleaseStaticDir(releaseId) {
  return path.join(getReleaseDir(releaseId), '.next', 'static');
}

function getReleaseServerEntry(releaseId) {
  return path.join(getReleaseDir(releaseId), 'server.js');
}

function getStaticSnapshotDir(releaseId) {
  return path.join(staticSnapshotsDir, releaseId);
}

function getRecentSnapshotIds(limit, preferredIds = []) {
  const snapshotIds = sortDirectoryNamesByMtime(
    staticSnapshotsDir,
    listDirectories(staticSnapshotsDir)
  );

  return dedupeStrings([...preferredIds, ...snapshotIds]).slice(0, Math.max(0, limit));
}

function pruneDirectories(targetDir, keepNames) {
  const removedNames = [];
  const keepSet = new Set(dedupeStrings(keepNames));

  for (const directoryName of listDirectories(targetDir)) {
    if (keepSet.has(directoryName)) {
      continue;
    }

    removeDirectory(path.join(targetDir, directoryName));
    removedNames.push(directoryName);
  }

  return removedNames;
}

module.exports = {
  DEFAULT_RELEASE_RETENTION,
  DEFAULT_STATIC_OVERLAP_RELEASES,
  copyDirectory,
  dedupeStrings,
  ensureDir,
  ensureExists,
  exists,
  getRecentSnapshotIds,
  getReleaseDir,
  getReleaseIdFromBuild,
  getReleaseServerEntry,
  getReleaseStaticDir,
  getStaticSnapshotDir,
  hostingerRoot,
  listDirectories,
  mergeDirectory,
  projectRoot,
  pruneDirectories,
  readReleaseState,
  releasesDir,
  releaseStatePath,
  removeDirectory,
  resolvePositiveInteger,
  staticSnapshotsDir,
  writeReleaseState,
};
