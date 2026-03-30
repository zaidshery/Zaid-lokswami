const path = require('path');
const {
  copyDirectory,
  exists,
  getStaticSnapshotDir,
  projectRoot,
  readReleaseState,
} = require('./hostinger-release-utils');

const LEGACY_SNAPSHOT_ID = 'legacy-live';
const legacyStandaloneStaticDir = path.join(
  projectRoot,
  '.next',
  'standalone',
  '.next',
  'static'
);
const legacyBuildStaticDir = path.join(projectRoot, '.next', 'static');

function resolveLegacyStaticSource() {
  if (exists(legacyStandaloneStaticDir)) {
    return legacyStandaloneStaticDir;
  }

  if (exists(legacyBuildStaticDir)) {
    return legacyBuildStaticDir;
  }

  return '';
}

function main() {
  const releaseState = readReleaseState();
  const hasManagedCurrentRelease =
    Boolean(releaseState.currentReleaseId) &&
    exists(path.join(projectRoot, '.hostinger', 'releases', releaseState.currentReleaseId));

  if (hasManagedCurrentRelease) {
    return;
  }

  const legacyStaticSource = resolveLegacyStaticSource();
  if (!legacyStaticSource) {
    return;
  }

  const targetSnapshotDir = getStaticSnapshotDir(LEGACY_SNAPSHOT_ID);
  copyDirectory(legacyStaticSource, targetSnapshotDir);
  console.log(`Preserved legacy Hostinger static assets in ${targetSnapshotDir}`);
}

main();
