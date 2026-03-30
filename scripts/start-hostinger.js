const path = require('path');
const { spawn } = require('child_process');
const {
  DEFAULT_RELEASE_RETENTION,
  dedupeStrings,
  exists,
  getReleaseDir,
  getReleaseServerEntry,
  projectRoot,
  pruneDirectories,
  readReleaseState,
  releasesDir,
  resolvePositiveInteger,
  writeReleaseState,
} = require('./hostinger-release-utils');

const legacyServerEntry = path.join(projectRoot, '.next', 'standalone', 'server.js');

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
  const releaseState = readReleaseState();

  if (releaseState.pendingReleaseId || releaseState.currentReleaseId) {
    const { releaseId } = promotePreparedRelease(releaseState);
    if (releaseId) {
      const serverEntry = getReleaseServerEntry(releaseId);
      return {
        mode: 'managed',
        releaseId,
        serverEntry,
      };
    }
  }

  if (exists(legacyServerEntry)) {
    return {
      mode: 'legacy',
      releaseId: 'legacy-standalone',
      serverEntry: legacyServerEntry,
    };
  }

  throw new Error(
    'No prepared Hostinger release was found. Run `npm run build:hostinger` first.'
  );
}

function main() {
  loadProjectEnvFiles();
  const target = resolveServerEntry();
  const releaseRoot =
    target.mode === 'managed'
      ? getReleaseDir(target.releaseId)
      : path.dirname(target.serverEntry);

  console.log(
    `Starting Hostinger release ${target.releaseId} from ${releaseRoot}`
  );

  const child = spawn(process.execPath, [target.serverEntry], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
  });

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', forwardSignal);
  process.on('SIGTERM', forwardSignal);

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on('error', (error) => {
    console.error('Failed to start Hostinger release:', error);
    process.exit(1);
  });
}

main();
