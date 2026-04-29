import { describe, expect, it } from 'vitest';
import { sanitizeCspReportPayload } from '@/lib/security/cspReport';

describe('CSP report sanitization', () => {
  it('normalizes browser CSP report payloads', () => {
    const entry = sanitizeCspReportPayload(
      {
        'csp-report': {
          'document-uri': 'https://lokswami.example/admin',
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
          'blocked-uri': 'eval',
          'line-number': 12,
          'column-number': 4,
          disposition: 'enforce',
        },
      },
      undefined,
      new Date('2026-04-29T00:00:00.000Z')
    );

    expect(entry).toMatchObject({
      timestamp: '2026-04-29T00:00:00.000Z',
      documentUri: 'https://lokswami.example/admin',
      violatedDirective: 'script-src',
      effectiveDirective: 'script-src',
      blockedUri: 'eval',
      lineNumber: 12,
      columnNumber: 4,
      disposition: 'enforce',
    });
  });
});

