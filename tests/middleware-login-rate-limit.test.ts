import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyAllLimiters } from '@/lib/security/getRateLimiter';

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn().mockResolvedValue(null),
}));

function createEvent() {
  return {
    waitUntil: vi.fn(),
  };
}

async function callMiddleware(
  url: string,
  init: ConstructorParameters<typeof NextRequest>[1] = {}
) {
  const { middleware } = await import('@/middleware');
  return middleware(new NextRequest(url, init), createEvent() as never);
}

describe('middleware login rate limiting', () => {
  afterEach(() => {
    destroyAllLimiters();
    vi.clearAllMocks();
  });

  it('does not rate limit opening the sign-in page', async () => {
    for (let index = 0; index < 8; index += 1) {
      const response = await callMiddleware('https://lokswami.com/signin', {
        headers: {
          'x-forwarded-for': '203.0.113.10',
        },
      });

      expect(response.status).not.toBe(429);
    }
  });

  it('does not return custom JSON for credential login API attempts', async () => {
    let response: Response | undefined;

    for (let index = 0; index < 6; index += 1) {
      response = await callMiddleware('https://lokswami.com/api/auth/callback/credentials', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.20',
        },
      });
    }

    expect(response?.status).not.toBe(429);
  });
});
