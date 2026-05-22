import { describe, expect, it } from 'vitest';

describe('short share redirect routes', () => {
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
});
