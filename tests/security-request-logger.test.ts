import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import {
  buildRequestLogEntry,
  sanitizeRequestLogPath,
  serializeRequestLogEntry,
} from '@/lib/security/requestLogger';

describe('Request Logger', () => {
  it('redacts sensitive query parameters', () => {
    expect(
      sanitizeRequestLogPath('/api/admin/articles?token=abc123&category=politics&api_key=secret')
    ).toBe('/api/admin/articles?token=%5BREDACTED%5D&category=politics&api_key=%5BREDACTED%5D');
  });

  it('builds a compact JSONL request entry', () => {
    const request = new NextRequest('https://lokswami.test/api/admin/articles?code=oauth&tab=all', {
      method: 'POST',
      headers: {
        'user-agent': 'Vitest Agent',
        'x-forwarded-for': '203.0.113.10, 10.0.0.1',
      },
    });

    const entry = buildRequestLogEntry({
      request,
      status: 202,
      duration: 12.4,
      timestamp: new Date('2026-04-29T10:30:00.000Z'),
      session: {
        userId: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
      },
    });

    expect(entry).toMatchObject({
      timestamp: '2026-04-29T10:30:00.000Z',
      method: 'POST',
      path: '/api/admin/articles?code=%5BREDACTED%5D&tab=all',
      status: 202,
      duration: 12,
      userId: 'admin-1',
      userEmail: 'admin@example.com',
      userRole: 'admin',
      ip: '203.0.113.10',
      userAgent: 'Vitest Agent',
    });

    expect(serializeRequestLogEntry(entry)).toBe(`${JSON.stringify(entry)}\n`);
  });
});
