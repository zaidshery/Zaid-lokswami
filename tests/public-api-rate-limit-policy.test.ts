import { describe, expect, it } from 'vitest';
import {
  getRouteScopedApiLimiterPrefix,
  isCacheablePublicReadApiRoute,
} from '@/lib/security/publicApiRateLimitPolicy';

describe('public API rate limit policy', () => {
  it('treats reader GET APIs as cacheable public reads', () => {
    expect(isCacheablePublicReadApiRoute('GET', '/api/health')).toBe(true);
    expect(isCacheablePublicReadApiRoute('GET', '/api/v1/public/articles')).toBe(true);
    expect(isCacheablePublicReadApiRoute('GET', '/api/v1/public/epapers/latest')).toBe(true);
    expect(isCacheablePublicReadApiRoute('GET', '/api/epapers/latest')).toBe(true);
    expect(isCacheablePublicReadApiRoute('HEAD', '/api/breaking')).toBe(true);
  });

  it('keeps writes and admin routes out of public read bypasses', () => {
    expect(isCacheablePublicReadApiRoute('POST', '/api/analytics/track')).toBe(false);
    expect(isCacheablePublicReadApiRoute('POST', '/api/v1/public/articles')).toBe(false);
    expect(isCacheablePublicReadApiRoute('GET', '/api/admin/articles')).toBe(false);
    expect(isCacheablePublicReadApiRoute('GET', '/api/auth/session')).toBe(false);
  });

  it('builds route-scoped public API limiter prefixes', () => {
    expect(getRouteScopedApiLimiterPrefix('/api/analytics/track')).toBe(
      'api:api:analytics:track'
    );
    expect(getRouteScopedApiLimiterPrefix('/api/contact')).toBe('api:api:contact');
  });
});
