import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('dependency security validator', () => {
  it('accepts the locked dependency tree after all tracked advisory fixes', () => {
    const output = execFileSync(
      process.execPath,
      [path.join(process.cwd(), 'scripts', 'validate-dependency-security.js')],
      { encoding: 'utf8' }
    );

    expect(output).toContain(
      'Dependency security check passed for all tracked advisory ranges.'
    );
  });
});
