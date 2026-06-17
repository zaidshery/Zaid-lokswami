import { afterEach, describe, expect, it } from 'vitest';

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (typeof originalSiteUrl === 'undefined') {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    return;
  }

  process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
});

describe('short share redirect routes', () => {
  it('redirects short article share URLs to the reader using the public request origin', async () => {
    const { GET } = await import('@/app/a/[id]/route');
    const response = await GET(
      new Request('http://0.0.0.0:3000/a/brics-agriculture-meeting-indore', {
        headers: {
          'x-forwarded-host': 'lokswami.com',
          'x-forwarded-proto': 'https',
        },
      }),
      {
        params: Promise.resolve({ id: 'brics-agriculture-meeting-indore' }),
      }
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://lokswami.com/main/article/brics-agriculture-meeting-indore'
    );
  });

  it('falls back to the configured public site URL for internal article share origins', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://lokswami.com';

    const { GET } = await import('@/app/a/[id]/route');
    const response = await GET(
      new Request('http://0.0.0.0:3000/a/indore-civic-update'),
      {
        params: Promise.resolve({ id: 'indore-civic-update' }),
      }
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://lokswami.com/main/article/indore-civic-update'
    );
  });

  it('ignores internal forwarded hosts that include a port when a public site URL is configured', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://lokswami.com';

    const { GET } = await import('@/app/a/[id]/route');
    const response = await GET(
      new Request('http://0.0.0.0:3000/a/proxy-internal-host', {
        headers: {
          'x-forwarded-host': '0.0.0.0:3000',
          'x-forwarded-proto': 'https',
        },
      }),
      {
        params: Promise.resolve({ id: 'proxy-internal-host' }),
      }
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://lokswami.com/main/article/proxy-internal-host'
    );
  });

  it('redirects short e-paper share URLs to the reader with full query names', async () => {
    const { GET } = await import('@/app/e/[paper]/route');
    const response = await GET(new Request('https://lokswami.com/e/paper-1?p=12&s=front'), {
      params: Promise.resolve({ paper: 'paper-1' }),
    });

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://lokswami.com/main/epaper?paper=paper-1&page=12&story=front'
    );
  });

  it('uses the forwarded public origin when the app receives an internal e-paper share URL', async () => {
    const { GET } = await import('@/app/e/[paper]/route');
    const response = await GET(
      new Request('http://0.0.0.0:3000/e/paper-1?p=7', {
        headers: {
          'x-forwarded-host': 'lokswami.com',
          'x-forwarded-proto': 'https',
        },
      }),
      {
        params: Promise.resolve({ paper: 'paper-1' }),
      }
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://lokswami.com/main/epaper?paper=paper-1&page=7'
    );
  });

  it('falls back to the configured public site URL for internal e-paper share origins', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://lokswami.com';

    const { GET } = await import('@/app/e/[paper]/route');
    const response = await GET(new Request('http://0.0.0.0:3000/e/paper-1?s=lead-story'), {
      params: Promise.resolve({ paper: 'paper-1' }),
    });

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://lokswami.com/main/epaper?paper=paper-1&story=lead-story'
    );
  });
});
