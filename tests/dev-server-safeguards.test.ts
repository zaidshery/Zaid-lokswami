import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  cleanNextArtifacts,
  resolveTargets,
} = require('../scripts/clean-next-artifacts.js') as {
  cleanNextArtifacts: (options: {
    projectRoot: string;
    targets: string[];
    allowDevServerPid?: number;
  }) => string[];
  resolveTargets: (targets: string[]) => string[];
};
const {
  claimDevServerState,
  getActiveDevServerState,
  releaseDevServerState,
} = require('../scripts/dev-server-state.js') as {
  claimDevServerState: (projectRoot: string) => {
    token: string;
    launcherPid: number;
  };
  getActiveDevServerState: (projectRoot: string) => {
    launcherPid: number;
  } | null;
  releaseDevServerState: (projectRoot: string, token: string) => void;
};

const temporaryRoots: string[] = [];

function createTemporaryRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lokswami-dev-guard-'));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('Next.js development artifact safeguards', () => {
  it('refuses to remove an active development build', () => {
    const projectRoot = createTemporaryRoot();
    fs.mkdirSync(path.join(projectRoot, '.next-dev'));
    const state = claimDevServerState(projectRoot);

    expect(getActiveDevServerState(projectRoot)?.launcherPid).toBe(process.pid);
    expect(() =>
      cleanNextArtifacts({
        projectRoot,
        targets: ['.next-dev'],
      })
    ).toThrow(/development server is running/i);
    expect(fs.existsSync(path.join(projectRoot, '.next-dev'))).toBe(true);

    releaseDevServerState(projectRoot, state.token);
  });

  it('lets the owning launcher clean before starting Next.js', () => {
    const projectRoot = createTemporaryRoot();
    fs.mkdirSync(path.join(projectRoot, '.next-dev'));
    const state = claimDevServerState(projectRoot);

    cleanNextArtifacts({
      projectRoot,
      targets: ['.next-dev'],
      allowDevServerPid: process.pid,
    });

    expect(fs.existsSync(path.join(projectRoot, '.next-dev'))).toBe(false);
    releaseDevServerState(projectRoot, state.token);
  });

  it('only accepts the two known Next.js build directories', () => {
    expect(resolveTargets(['.next', './.next-dev', '.next'])).toEqual([
      '.next',
      '.next-dev',
    ]);
    expect(() => resolveTargets(['public'])).toThrow(/refusing to remove/i);
  });

  it('keeps development and production cleanup separate in package scripts', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts.dev).toBe('node scripts/start-next-dev.js');
    expect(packageJson.scripts.predev).toBeUndefined();
    expect(packageJson.scripts.prebuild).toContain('clean:next:prod');
    expect(packageJson.scripts['clean:next:prod']).toBe(
      'node scripts/clean-next-artifacts.js .next'
    );
  });
});
