const path = require('path');
const {
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
  getStaticSnapshotDir,
  hostingerRoot,
  mergeDirectory,
  projectRoot,
  pruneDirectories,
  readReleaseState,
  releasesDir,
  removeDirectory,
  resolvePositiveInteger,
  sharedStaticDir,
  staticSnapshotsDir,
  writeReleaseState,
} = require('./hostinger-release-utils');

const nextDir = path.join(projectRoot, '.next');
const standaloneDir = path.join(nextDir, 'standalone');
const staticSourceDir = path.join(nextDir, 'static');
const publicSourceDir = path.join(projectRoot, 'public');

function main() {
  const releaseId = getReleaseIdFromBuild(nextDir);
  const overlapReleaseCount = resolvePositiveInteger(
    process.env.HOSTINGER_STATIC_OVERLAP_RELEASES,
    DEFAULT_STATIC_OVERLAP_RELEASES
  );
  const releaseRetentionCount = resolvePositiveInteger(
    process.env.HOSTINGER_RELEASE_RETENTION,
    DEFAULT_RELEASE_RETENTION
  );
  const releaseState = readReleaseState();

  ensureExists(standaloneDir, 'Standalone build output');
  ensureExists(staticSourceDir, 'Next static assets');

  ensureDir(hostingerRoot);
  ensureDir(releasesDir);
  ensureDir(staticSnapshotsDir);

  const releaseDir = getReleaseDir(releaseId);
  const tempReleaseDir = path.join(
    releasesDir,
    `${releaseId}.tmp-${process.pid}`
  );
  const tempSharedStaticDir = path.join(
    hostingerRoot,
    `shared-next-static.tmp-${process.pid}`
  );
  const nextStaticSnapshotDir = getStaticSnapshotDir(releaseId);
  const preferredSnapshotIds = dedupeStrings([releaseState.currentReleaseId]);
  const overlapSnapshotIds = getRecentSnapshotIds(
    Math.max(0, overlapReleaseCount - 1),
    preferredSnapshotIds
  ).filter(
    (snapshotId) =>
      snapshotId !== releaseId && exists(getStaticSnapshotDir(snapshotId))
  );

  copyDirectory(staticSourceDir, nextStaticSnapshotDir);

  removeDirectory(tempReleaseDir);
  copyDirectory(standaloneDir, tempReleaseDir);
  removeDirectory(path.join(tempReleaseDir, '.hostinger'));
  copyDirectory(publicSourceDir, path.join(tempReleaseDir, 'public'));
  copyDirectory(staticSourceDir, path.join(tempReleaseDir, '.next', 'static'));

  let mergedFallbackFileCount = 0;
  for (const snapshotId of overlapSnapshotIds) {
    const snapshotDir = getStaticSnapshotDir(snapshotId);
    if (!exists(snapshotDir)) {
      continue;
    }

    mergedFallbackFileCount += mergeDirectory(
      snapshotDir,
      path.join(tempReleaseDir, '.next', 'static'),
      { overwrite: false }
    );
  }

  removeDirectory(releaseDir);
  require('fs').renameSync(tempReleaseDir, releaseDir);

  const nextHistoryIds = dedupeStrings([
    releaseId,
    releaseState.currentReleaseId,
    ...releaseState.releaseHistoryIds,
  ]).slice(0, releaseRetentionCount);
  writeReleaseState({
    ...releaseState,
    pendingReleaseId: releaseId,
    releaseHistoryIds: nextHistoryIds,
    lastPreparedAt: new Date().toISOString(),
  });

  const snapshotRetentionCount = Math.max(
    releaseRetentionCount,
    overlapReleaseCount + 2
  );
  const snapshotIdsToKeep = dedupeStrings([
    releaseId,
    ...getRecentSnapshotIds(snapshotRetentionCount, preferredSnapshotIds),
  ]).filter((snapshotId) => exists(getStaticSnapshotDir(snapshotId)));

  removeDirectory(tempSharedStaticDir);
  copyDirectory(staticSourceDir, tempSharedStaticDir);

  let mergedSharedStaticFileCount = 0;
  for (const snapshotId of snapshotIdsToKeep) {
    if (snapshotId === releaseId) {
      continue;
    }

    const snapshotDir = getStaticSnapshotDir(snapshotId);
    if (!exists(snapshotDir)) {
      continue;
    }

    mergedSharedStaticFileCount += mergeDirectory(
      snapshotDir,
      tempSharedStaticDir,
      { overwrite: false }
    );
  }

  removeDirectory(sharedStaticDir);
  require('fs').renameSync(tempSharedStaticDir, sharedStaticDir);

  const removedSnapshotIds = pruneDirectories(
    staticSnapshotsDir,
    snapshotIdsToKeep
  );

  console.log(
    [
      `Prepared Hostinger release ${releaseId}`,
      `- release dir: ${releaseDir}`,
      `- preserved static overlap snapshots: ${overlapSnapshotIds.length}`,
      `- merged fallback asset files: ${mergedFallbackFileCount}`,
      `- shared static bundle: ${sharedStaticDir}`,
      `- merged shared fallback asset files: ${mergedSharedStaticFileCount}`,
      removedSnapshotIds.length > 0
        ? `- pruned old static snapshots: ${removedSnapshotIds.join(', ')}`
        : '',
      '- the new release will be promoted on the next start:hostinger run',
    ]
      .filter(Boolean)
      .join('\n')
  );
}

main();
