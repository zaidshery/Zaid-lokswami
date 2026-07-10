import { describe, expect, it } from 'vitest';
import { canViewPage } from '@/lib/auth/permissions';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { getRoleWorkflowGuide } from '@/lib/admin/roleWorkflowGuide';

describe('role workflow guide', () => {
  it('gives every admin role a concise three-step workflow', () => {
    for (const role of ADMIN_ROLES) {
      const guide = getRoleWorkflowGuide(role);
      expect(guide.title).toBeTruthy();
      expect(guide.summary).toBeTruthy();
      expect(guide.authority).toBeTruthy();
      expect(guide.steps).toHaveLength(3);
    }
  });

  it('only links roles to pages they can access', () => {
    for (const role of ADMIN_ROLES) {
      const guide = getRoleWorkflowGuide(role);
      expect(canViewPage(role, guide.primaryAction.pageKey)).toBe(true);
      expect(canViewPage(role, guide.secondaryAction.pageKey)).toBe(true);
    }
  });

  it('preserves monthly E-Magazine ownership in the admin and copy-desk guidance', () => {
    expect(getRoleWorkflowGuide('admin').authority).toContain('monthly issue');
    expect(getRoleWorkflowGuide('copy_editor').authority).toContain('monthly E-Magazine');
  });
});
