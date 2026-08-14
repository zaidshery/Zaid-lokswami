import { describe, expect, it } from 'vitest';
import { parseArgs } from '@/scripts/seo-health-audit';

describe('SEO Phase 9 - Production Governance & Health Scanner', () => {
  it('parses custom baseUrl argument', () => {
    const originalArgv = process.argv;
    process.argv = ['node', 'scripts/seo-health-audit.js', '--baseUrl=https://lokswami.com', '--timeoutMs=15000'];

    const args = parseArgs();
    expect(args.baseUrl).toBe('https://lokswami.com');
    expect(args.timeoutMs).toBe(15000);

    process.argv = originalArgv;
  });

  it('uses default baseUrl when no args are passed', () => {
    const originalArgv = process.argv;
    process.argv = ['node', 'scripts/seo-health-audit.js'];

    const args = parseArgs();
    expect(args.baseUrl).toBe('https://lokswami.com');
    expect(args.timeoutMs).toBe(20000);

    process.argv = originalArgv;
  });
});
