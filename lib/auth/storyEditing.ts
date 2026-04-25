import {
  canEditContent,
  isAssignedContent,
  isOwnContent,
  canManageWorkflowAssignments,
  resolveWorkflowStatus,
  type PermissionContentRecord,
  type PermissionUser,
} from '@/lib/auth/permissions';
import { isCopyEditorRole, isReporterDeskRole, isSuperAdminRole } from '@/lib/auth/roles';

export const STORY_COMMON_EDIT_FIELDS = [
  'title',
  'caption',
  'thumbnail',
  'category',
  'durationSeconds',
] as const;

export const STORY_LINK_EDIT_FIELDS = ['linkUrl', 'linkLabel'] as const;

export const STORY_MEDIA_EDIT_FIELDS = [
  'mediaType',
  'mediaUrl',
  'mediaKey',
  'mediaSizeBytes',
  'mediaMimeType',
  'storageProvider',
  'mediaAssets',
] as const;

export const STORY_REPORTER_META_EDIT_FIELDS = ['reporterMeta'] as const;
export const STORY_COPY_DESK_EDIT_FIELDS = ['copyEditorMeta'] as const;

export const STORY_ADMIN_EDIT_FIELDS = [
  'author',
  'priority',
  'views',
  'isPublished',
  'publishedAt',
] as const;

export const STORY_ALL_EDIT_FIELDS = [
  ...STORY_COMMON_EDIT_FIELDS,
  ...STORY_LINK_EDIT_FIELDS,
  ...STORY_MEDIA_EDIT_FIELDS,
  ...STORY_REPORTER_META_EDIT_FIELDS,
  ...STORY_COPY_DESK_EDIT_FIELDS,
  ...STORY_ADMIN_EDIT_FIELDS,
] as const;

export type StoryEditableField = (typeof STORY_ALL_EDIT_FIELDS)[number];

function addFields(target: Set<StoryEditableField>, fields: readonly StoryEditableField[]) {
  fields.forEach((field) => target.add(field));
}

export function getStoryEditableFieldSet(
  user: PermissionUser | null | undefined,
  content: PermissionContentRecord
) {
  const editableFields = new Set<StoryEditableField>();
  if (!user || !canEditContent(user, content)) {
    return editableFields;
  }

  if (isSuperAdminRole(user.role) || user.role === 'admin') {
    addFields(editableFields, STORY_ALL_EDIT_FIELDS);
    return editableFields;
  }

  if (isReporterDeskRole(user.role)) {
    addFields(editableFields, STORY_COMMON_EDIT_FIELDS);
    addFields(editableFields, STORY_MEDIA_EDIT_FIELDS);
    addFields(editableFields, STORY_REPORTER_META_EDIT_FIELDS);
    return editableFields;
  }

  if (isCopyEditorRole(user.role)) {
    addFields(editableFields, STORY_COMMON_EDIT_FIELDS);
    addFields(editableFields, STORY_LINK_EDIT_FIELDS);
    addFields(editableFields, STORY_COPY_DESK_EDIT_FIELDS);
    return editableFields;
  }

  return editableFields;
}

export function getStoryEditCapabilities(
  user: PermissionUser | null | undefined,
  content: PermissionContentRecord
) {
  const editableFields = getStoryEditableFieldSet(user, content);
  const canManageAssignments = Boolean(
    user?.role && canManageWorkflowAssignments(user.role)
  );
  const canDownloadStoryAssets = getCanDownloadStoryAssets(user, content);

  return {
    editableFields,
    canSaveStory: editableFields.size > 0,
    canEditCommonFields: STORY_COMMON_EDIT_FIELDS.some((field) => editableFields.has(field)),
    canEditLinkFields: STORY_LINK_EDIT_FIELDS.some((field) => editableFields.has(field)),
    canEditMediaFields: STORY_MEDIA_EDIT_FIELDS.some((field) => editableFields.has(field)),
    canEditReporterFields: STORY_REPORTER_META_EDIT_FIELDS.some((field) =>
      editableFields.has(field)
    ),
    canEditCopyDeskFields: STORY_COPY_DESK_EDIT_FIELDS.some((field) =>
      editableFields.has(field)
    ),
    canEditAdminFields: STORY_ADMIN_EDIT_FIELDS.some((field) => editableFields.has(field)),
    canReplaceStoryVideo: STORY_MEDIA_EDIT_FIELDS.some((field) => editableFields.has(field)),
    canUseManualVideoUrl: Boolean(user && (isSuperAdminRole(user.role) || user.role === 'admin')),
    canManageAssignments,
    canDownloadStoryAssets,
  };
}

export function getCanDownloadStoryAssets(
  user: PermissionUser | null | undefined,
  content: PermissionContentRecord
) {
  if (!user) return false;

  if (isSuperAdminRole(user.role) || user.role === 'admin') {
    return true;
  }

  if (isReporterDeskRole(user.role)) {
    return isOwnContent(user, content);
  }

  if (isCopyEditorRole(user.role)) {
    return isAssignedContent(user, content) || resolveWorkflowStatus(content) === 'submitted';
  }

  return false;
}

export function getBlockedStoryUpdateFields(
  user: PermissionUser | null | undefined,
  content: PermissionContentRecord,
  requestedFields: string[]
) {
  const editableFields = getStoryEditableFieldSet(user, content);
  return requestedFields.filter(
    (field): field is StoryEditableField =>
      (STORY_ALL_EDIT_FIELDS as readonly string[]).includes(field) && !editableFields.has(field as StoryEditableField)
  );
}
