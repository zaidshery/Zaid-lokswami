import { describe, expect, it } from 'vitest';
import {
  canCreateContent,
  canEditContent,
  canManageLeadershipReports,
  canManageSettings,
  canManageTeam,
  canReadContent,
  canTransitionContent,
  canViewPage,
} from '@/lib/auth/permissions';

describe('governance permission helpers', () => {
  const baseContent = {
    workflowStatus: 'draft' as const,
    createdById: 'reporter-1',
    assignedToId: 'copy-editor-1',
    legacyAuthorName: 'Reporter One',
  };

  const superAdmin = {
    id: 'super-1',
    email: 'boss@example.com',
    name: 'Boss',
    role: 'super_admin' as const,
  };

  const admin = {
    id: 'admin-1',
    email: 'desk@example.com',
    name: 'Desk',
    role: 'admin' as const,
  };

  const copyEditor = {
    id: 'copy-editor-1',
    email: 'copy@example.com',
    name: 'Copy Editor',
    role: 'copy_editor' as const,
  };

  const reporter = {
    id: 'reporter-1',
    email: 'reporter@example.com',
    name: 'Reporter One',
    role: 'reporter' as const,
  };

  it('locks governance pages to super admin only', () => {
    expect(canViewPage(superAdmin.role, 'audit_log')).toBe(true);
    expect(canViewPage(superAdmin.role, 'permission_review')).toBe(true);
    expect(canViewPage(superAdmin.role, 'operations_diagnostics')).toBe(true);

    expect(canViewPage(admin.role, 'audit_log')).toBe(false);
    expect(canViewPage(copyEditor.role, 'permission_review')).toBe(false);
    expect(canViewPage(reporter.role, 'operations_diagnostics')).toBe(false);
  });

  it('keeps leadership controls narrower than normal analytics access', () => {
    expect(canViewPage(superAdmin.role, 'analytics')).toBe(true);
    expect(canViewPage(superAdmin.role, 'revenue')).toBe(true);
    expect(canViewPage(admin.role, 'analytics')).toBe(true);
    expect(canViewPage(admin.role, 'revenue')).toBe(false);
    expect(canViewPage(admin.role, 'newsroom_settings')).toBe(true);
    expect(canManageLeadershipReports(superAdmin.role)).toBe(true);
    expect(canManageLeadershipReports(admin.role)).toBe(false);
    expect(canManageSettings(superAdmin.role)).toBe(true);
    expect(canManageSettings(admin.role)).toBe(false);
    expect(canManageTeam(superAdmin.role)).toBe(true);
    expect(canManageTeam(admin.role)).toBe(true);
  });

  it('routes newsroom control panels to the correct desks', () => {
    expect(canViewPage(admin.role, 'assignments')).toBe(true);
    expect(canViewPage(admin.role, 'content_queue')).toBe(true);
    expect(canViewPage(admin.role, 'push_alerts')).toBe(true);
    expect(canViewPage(copyEditor.role, 'copy_desk')).toBe(true);
    expect(canViewPage(reporter.role, 'copy_desk')).toBe(false);
    expect(canViewPage(reporter.role, 'push_alerts')).toBe(false);
  });

  it('limits content creation by role', () => {
    expect(canCreateContent(reporter.role, 'article')).toBe(true);
    expect(canCreateContent(reporter.role, 'story')).toBe(true);
    expect(canCreateContent(reporter.role, 'video')).toBe(false);
    expect(canCreateContent(copyEditor.role, 'story')).toBe(false);
    expect(canCreateContent(admin.role, 'video')).toBe(true);
  });

  it('lets reporters work only on their own content transitions', () => {
    expect(canReadContent(reporter, baseContent)).toBe(true);
    expect(canEditContent(reporter, baseContent)).toBe(true);
    expect(canTransitionContent(reporter, baseContent, 'submit')).toBe(true);
    expect(canTransitionContent(reporter, { ...baseContent, createdById: reporter.id }, 'approve')).toBe(false);
  });

  it('lets copy editors work only on assigned review items', () => {
    expect(canReadContent(copyEditor, baseContent)).toBe(true);
    expect(canEditContent(copyEditor, baseContent)).toBe(true);
    expect(canTransitionContent(copyEditor, baseContent, 'start_review')).toBe(true);
    expect(canTransitionContent(copyEditor, baseContent, 'move_to_copy_edit')).toBe(true);
    expect(canTransitionContent(copyEditor, baseContent, 'request_changes')).toBe(true);
    expect(canTransitionContent(copyEditor, baseContent, 'mark_ready_for_approval')).toBe(true);
    expect(canTransitionContent(copyEditor, baseContent, 'approve')).toBe(false);
    expect(canTransitionContent(copyEditor, baseContent, 'reject')).toBe(false);
    expect(canTransitionContent(copyEditor, baseContent, 'publish')).toBe(false);
    expect(canEditContent(copyEditor, { ...baseContent, assignedToId: 'someone-else' })).toBe(false);
  });

  it('keeps admin and super admin fully operational on workflow actions', () => {
    expect(canTransitionContent(admin, baseContent, 'publish')).toBe(true);
    expect(canTransitionContent(superAdmin, baseContent, 'archive')).toBe(true);
    expect(canEditContent(admin, baseContent)).toBe(true);
    expect(canEditContent(superAdmin, baseContent)).toBe(true);
  });
});
