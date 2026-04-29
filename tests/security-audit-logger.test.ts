import { describe, expect, it } from 'vitest';
import { sanitizeAuditPayload } from '@/lib/security/auditLogger';

describe('Audit Logger', () => {
  it('redacts sensitive fields before storing audit payloads', () => {
    const payload = sanitizeAuditPayload({
      title: 'Public headline',
      password: 'secret-password',
      nested: {
        apiKey: 'private-key',
        safe: 'visible',
      },
      sessions: [
        {
          token: 'private-token',
          label: 'mobile',
        },
      ],
    });

    expect(payload.title).toBe('Public headline');
    expect(payload.password).toBe('[REDACTED]');
    expect(payload.nested).toEqual({
      apiKey: '[REDACTED]',
      safe: 'visible',
    });
    expect(payload.sessions).toEqual([
      {
        token: '[REDACTED]',
        label: 'mobile',
      },
    ]);
  });

  it('truncates oversized strings and objects', () => {
    const payload = sanitizeAuditPayload({
      longText: 'a'.repeat(2500),
      ...Object.fromEntries(Array.from({ length: 60 }, (_, index) => [`field${index}`, index])),
    });

    expect(String(payload.longText)).toContain('[truncated]');
    expect(payload.__truncatedKeys).toBe(11);
  });
});
