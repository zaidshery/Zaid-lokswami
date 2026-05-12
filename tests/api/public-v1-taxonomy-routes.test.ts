import { describe, expect, it } from 'vitest';

describe('API v1 public taxonomy routes', () => {
  it('returns public categories in a standard cached envelope', async () => {
    const { GET } = await import('@/app/api/v1/public/categories/route');
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('s-maxage=3600');
    expect(payload.success).toBe(true);
    expect(payload.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: 'politics',
          href: '/main/category/politics',
        }),
      ])
    );
    expect(payload.meta).toEqual({ source: 'static' });
  });

  it('returns public cities in a standard cached envelope', async () => {
    const { GET } = await import('@/app/api/v1/public/cities/route');
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('s-maxage=3600');
    expect(payload.success).toBe(true);
    expect(payload.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: 'indore',
          href: '/main/epaper?city=indore',
        }),
      ])
    );
    expect(payload.meta).toEqual({ source: 'static' });
  });
});
