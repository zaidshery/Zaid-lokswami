const {
  exists,
  getReleaseDir,
  readReleaseState,
  writeReleaseState,
} = require('./hostinger-release-utils');

function resolveRollbackReleaseId(releaseState, requestedReleaseId) {
  const requested = String(requestedReleaseId || '').trim();
  if (requested) {
    return requested;
  }

  return (
    releaseState.releaseHistoryIds.find(
      (releaseId) => releaseId && releaseId !== releaseState.currentReleaseId
    ) || ''
  );
}

function main() {
  const releaseState = readReleaseState();
  const rollbackReleaseId = resolveRollbackReleaseId(
    releaseState,
    process.argv[2]
  );

  if (!rollbackReleaseId) {
    throw new Error(
      'No previous Hostinger release is available to roll back to.'
    );
  }

  const rollbackReleaseDir = getReleaseDir(rollbackReleaseId);
  if (!exists(rollbackReleaseDir)) {
    throw new Error(
      `Rollback release directory was not found: ${rollbackReleaseDir}`
    );
  }

  writeReleaseState({
    ...releaseState,
    pendingReleaseId: rollbackReleaseId,
  });

  console.log(
    [
      `Prepared rollback to Hostinger release ${rollbackReleaseId}.`,
      'Run `npm run start:hostinger` to promote it.',
    ].join('\n')
  );
}

main();
