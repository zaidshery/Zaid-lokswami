import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getRequestLogSummary } from '@/lib/security/requestLogReader';

const originalRequestLogDir = process.env.REQUEST_LOG_DIR;

describe('request log reader', () => {
  afterEach(() => {
    if (originalRequestLogDir === undefined) {
      delete process.env.REQUEST_LOG_DIR;
    } else {
      process.env.REQUEST_LOG_DIR = originalRequestLogDir;
    }
  });

  it('summarizes auth, validation, rate limit, and slow route signals', async () => {
    const logDir = await mkdtemp(path.join(os.tmpdir(), 'lokswami-request-logs-'));
    process.env.REQUEST_LOG_DIR = logDir;
    await writeFile(
      path.join(logDir, '2026-04-29-api-requests.jsonl'),
      [
        JSON.stringify({
          timestamp: '2026-04-29T01:00:00.000Z',
          method: 'GET',
          path: '/api/articles/latest',
          status: 200,
          duration: 1200,
          userId: null,
          userEmail: null,
          userRole: null,
          ip: '127.0.0.1',
          userAgent: 'test',
        }),
        JSON.stringify({
          timestamp: '2026-04-29T01:01:00.000Z',
          method: 'POST',
          path: '/api/admin/team',
          status: 403,
          duration: 20,
          userId: 'admin',
          userEmail: 'admin@example.com',
          userRole: 'admin',
          ip: '127.0.0.1',
          userAgent: 'test',
        }),
        JSON.stringify({
          timestamp: '2026-04-29T01:02:00.000Z',
          method: 'POST',
          path: '/api/admin/team',
          status: 429,
          duration: 5,
          userId: null,
          userEmail: null,
          userRole: null,
          ip: '127.0.0.1',
          userAgent: 'test',
        }),
        JSON.stringify({
          timestamp: '2026-04-29T01:03:00.000Z',
          method: 'POST',
          path: '/api/admin/team',
          status: 400,
          duration: 5,
          userId: null,
          userEmail: null,
          userRole: null,
          ip: '127.0.0.1',
          userAgent: 'test',
        }),
      ].join('\n'),
      'utf8'
    );

    const summary = await getRequestLogSummary({ maxFiles: 1, slowMs: 1000 });

    expect(summary.total).toBe(4);
    expect(summary.failedAuth).toBe(1);
    expect(summary.rateLimited).toBe(1);
    expect(summary.validationFailures).toBe(1);
    expect(summary.slowRequests).toBe(1);
    expect(summary.slowestRoutes[0].path).toBe('/api/articles/latest');
  });
});
