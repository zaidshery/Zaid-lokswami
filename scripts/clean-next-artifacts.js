const fs = require('fs');
const path = require('path');
const {
  getActiveDevServerState,
} = require('./dev-server-state');

const ALLOWED_TARGETS = new Set(['.next', '.next-dev']);

function normalizeTarget(value) {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '');
}

function resolveTargets(values) {
  const requested = values.length > 0 ? values : ['.next', '.next-dev'];
  const targets = Array.from(new Set(requested.map(normalizeTarget).filter(Boolean)));

  for (const target of targets) {
    if (!ALLOWED_TARGETS.has(target)) {
      throw new Error(`Refusing to remove unsupported Next.js artifact directory: ${target}`);
    }
  }

  return targets;
}

function cleanNextArtifacts({
  projectRoot = process.cwd(),
  targets = ['.next', '.next-dev'],
  allowDevServerPid = 0,
} = {}) {
  const resolvedTargets = resolveTargets(targets);

  if (resolvedTargets.includes('.next-dev')) {
    const activeState = getActiveDevServerState(projectRoot);
    const ownsActiveServer =
      Number(allowDevServerPid) > 0 &&
      [activeState?.launcherPid, activeState?.childPid].includes(Number(allowDevServerPid));

    if (activeState && !ownsActiveServer) {
      const activePid = activeState.childPid || activeState.launcherPid;
      throw new Error(
        `Refusing to remove .next-dev while the development server is running (PID ${activePid}).`
      );
    }
  }

  for (const target of resolvedTargets) {
    fs.rmSync(path.join(projectRoot, target), { recursive: true, force: true });
  }

  return resolvedTargets;
}

function main() {
  try {
    const removed = cleanNextArtifacts({ targets: process.argv.slice(2) });
    console.log(`Removed ${removed.join(', ')}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  cleanNextArtifacts,
  normalizeTarget,
  resolveTargets,
};
