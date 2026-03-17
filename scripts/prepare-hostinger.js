const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const nextDir = path.join(projectRoot, '.next');
const standaloneDir = path.join(nextDir, 'standalone');
const standaloneNextDir = path.join(standaloneDir, '.next');
const staticSourceDir = path.join(nextDir, 'static');
const staticTargetDir = path.join(standaloneNextDir, 'static');
const publicSourceDir = path.join(projectRoot, 'public');
const publicTargetDir = path.join(standaloneDir, 'public');

function ensureExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} not found: ${targetPath}`);
  }
}

function copyDirectory(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
}

function main() {
  ensureExists(standaloneDir, 'Standalone build output');
  ensureExists(staticSourceDir, 'Next static assets');

  copyDirectory(staticSourceDir, staticTargetDir);
  copyDirectory(publicSourceDir, publicTargetDir);

  console.log('Hostinger bundle prepared in .next/standalone');
}

main();
