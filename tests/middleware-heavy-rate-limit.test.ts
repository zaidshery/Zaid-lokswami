import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyAllLimiters } from '@/lib/security/getRateLimiter';

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/security/requestLogger', () => ({
  logApiRequestFromMiddleware: vi.fn().mockResolvedValue(undefined),
}));

function createEvent() {
  return {
    waitUntil: vi.fn(),
  };
}

async function callMiddleware(pathname: string) {
  const { middleware } = await import('@/middleware');
  const request = new NextRequest(`https://lokswami.com${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.30',
    },
  });

  return middleware(request, createEvent() as never);
}

describe('middleware heavy route rate limiting', () => {
  afterEach(() => {
    destroyAllLimiters();
    vi.clearAllMocks();
  });

  it('keeps crop and OCR quotas independent', async () => {
    const epaperPath = '/api/admin/epapers/507f1f77bcf86cd799439011';

    for (let index = 0; index < 20; index += 1) {
      const response = await callMiddleware(`${epaperPath}/crop-hotspot`);
      expect(response.status).not.toBe(429);
    }

    const ocrResponse = await callMiddleware(`${epaperPath}/ocr`);
    expect(ocrResponse.status).not.toBe(429);

    const blockedCropResponse = await callMiddleware(`${epaperPath}/crop-hotspot`);
    expect(blockedCropResponse.status).toBe(429);
    expect(blockedCropResponse.headers.get('Retry-After')).toBe('60');
  });
});
