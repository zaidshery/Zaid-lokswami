import { describe, expect, it } from 'vitest';
import { getPermissionReviewData } from '@/lib/admin/permissionReview';

describe('getPermissionReviewData', () => {
  it('flags super-admin-only and broad newsroom surfaces from the live permission map', async () => {
    const review = await getPermissionReviewData();

    expect(review.superAdminOnlyPages.some((entry) => entry.key === 'audit_log')).toBe(true);
    expect(
      review.superAdminOnlyPages.some((entry) => entry.key === 'permission_review')
    ).toBe(true);
    expect(
      review.superAdminOnlyPages.some((entry) => entry.key === 'operations_diagnostics')
    ).toBe(true);
    expect(review.broadAccessPages.some((entry) => entry.key === 'dashboard')).toBe(true);
    expect(review.broadAccessPages.some((entry) => entry.key === 'stories')).toBe(true);
    expect(review.broadAccessPages.some((entry) => entry.key === 'articles')).toBe(false);
  });
});
