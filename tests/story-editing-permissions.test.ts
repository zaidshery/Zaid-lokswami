import { describe, expect, it } from 'vitest';
import {
  getCanDownloadStoryAssets,
  getBlockedStoryUpdateFields,
  getStoryEditCapabilities,
} from '@/lib/auth/storyEditing';

describe('story editing capabilities', () => {
  const reporter = {
    id: 'reporter-1',
    email: 'reporter@example.com',
    name: 'Reporter One',
    role: 'reporter' as const,
  };

  const copyEditor = {
    id: 'copy-editor-1',
    email: 'copy@example.com',
    name: 'Copy Editor',
    role: 'copy_editor' as const,
  };

  const admin = {
    id: 'admin-1',
    email: 'admin@example.com',
    name: 'Admin',
    role: 'admin' as const,
  };

  const reporterDraftRecord = {
    workflow: {
      status: 'draft' as const,
      createdBy: { id: reporter.id },
      assignedTo: null,
    },
    legacyAuthorName: reporter.name,
  };

  const assignedCopyEditRecord = {
    workflow: {
      status: 'copy_edit' as const,
      createdBy: { id: reporter.id },
      assignedTo: { id: copyEditor.id },
    },
    legacyAuthorName: reporter.name,
  };

  const someoneElsesStoryRecord = {
    workflow: {
      status: 'submitted' as const,
      createdBy: { id: 'reporter-2' },
      assignedTo: { id: copyEditor.id },
    },
    legacyAuthorName: 'Reporter Two',
  };

  it('gives reporters source and upload controls on editable drafts', () => {
    const capabilities = getStoryEditCapabilities(reporter, reporterDraftRecord);

    expect(capabilities.canSaveStory).toBe(true);
    expect(capabilities.canEditCommonFields).toBe(true);
    expect(capabilities.canEditMediaFields).toBe(true);
    expect(capabilities.canEditReporterFields).toBe(true);
    expect(capabilities.canEditCopyDeskFields).toBe(false);
    expect(capabilities.canUseManualVideoUrl).toBe(false);
  });

  it('limits copy editors to editorial package and copy desk fields', () => {
    const capabilities = getStoryEditCapabilities(copyEditor, assignedCopyEditRecord);

    expect(capabilities.canSaveStory).toBe(true);
    expect(capabilities.canEditCommonFields).toBe(true);
    expect(capabilities.canEditLinkFields).toBe(true);
    expect(capabilities.canEditCopyDeskFields).toBe(true);
    expect(capabilities.canEditReporterFields).toBe(false);
    expect(capabilities.canEditMediaFields).toBe(false);
    expect(capabilities.canDownloadStoryAssets).toBe(true);
  });

  it('flags blocked story update fields for copy editors', () => {
    const blockedFields = getBlockedStoryUpdateFields(copyEditor, assignedCopyEditRecord, [
      'title',
      'reporterMeta',
      'mediaUrl',
      'copyEditorMeta',
    ]);

    expect(blockedFields).toEqual(['reporterMeta', 'mediaUrl']);
  });

  it('keeps admin fully editable across story fields', () => {
    const blockedFields = getBlockedStoryUpdateFields(admin, assignedCopyEditRecord, [
      'title',
      'reporterMeta',
      'mediaUrl',
      'copyEditorMeta',
      'priority',
      'views',
    ]);

    expect(blockedFields).toEqual([]);
  });

  it('lets reporters download only their own story assets', () => {
    expect(getCanDownloadStoryAssets(reporter, reporterDraftRecord)).toBe(true);
    expect(getCanDownloadStoryAssets(reporter, someoneElsesStoryRecord)).toBe(false);
  });
});
