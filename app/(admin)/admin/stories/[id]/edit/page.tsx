'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Image as ImageIcon,
  Loader2,
  Save,
} from 'lucide-react';
import { getAuthHeader } from '@/lib/auth/clientToken';
import {
  FACT_CHECK_STATUSES,
  HEADLINE_STATUSES,
  IMAGE_OPTIMIZATION_STATUSES,
} from '@/lib/content/newsroomMetadata';
import {
  canManageWorkflowAssignments,
  canTransitionContent,
  type ContentTransitionAction,
} from '@/lib/auth/permissions';
import {
  isAdminRole,
  isCopyEditorRole,
  isReporterDeskRole,
  type AdminRole,
} from '@/lib/auth/roles';
import { NEWS_CATEGORIES } from '@/lib/constants/newsCategories';
import { formatUiDateTime } from '@/lib/utils/dateFormat';
import {
  buildWorkflowFeedbackSummary,
  type WorkflowFeedbackTone,
} from '@/lib/workflow/feedback';
import { getAllowedWorkflowTransitions } from '@/lib/workflow/transitions';
import type { WorkflowPriority, WorkflowStatus } from '@/lib/workflow/types';

interface StoryFormData {
  title: string;
  caption: string;
  thumbnail: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  linkUrl: string;
  linkLabel: string;
  category: string;
  author: string;
  locationTag: string;
  sourceInfo: string;
  sourceConfidential: boolean;
  reporterNotes: string;
  proofreadComplete: boolean;
  factCheckStatus: 'pending' | 'verified' | 'needs_follow_up';
  headlineStatus: 'pending' | 'rewritten' | 'approved';
  imageOptimizationStatus: 'pending' | 'optimized' | 'not_needed';
  copyEditorNotes: string;
  returnForChangesReason: string;
  durationSeconds: string;
  priority: string;
  views: string;
}

type StoryReporterMeta = {
  locationTag?: string;
  sourceInfo?: string;
  sourceConfidential?: boolean;
  reporterNotes?: string;
};

type StoryCopyEditorMeta = {
  proofreadComplete?: boolean;
  factCheckStatus?: StoryFormData['factCheckStatus'];
  headlineStatus?: StoryFormData['headlineStatus'];
  imageOptimizationStatus?: StoryFormData['imageOptimizationStatus'];
  copyEditorNotes?: string;
  returnForChangesReason?: string;
};

type WorkflowActor = {
  id?: string;
  name?: string;
  email?: string;
  role?: AdminRole;
};

type WorkflowCommentItem = {
  id?: string;
  body?: string;
  kind?: string;
  author?: WorkflowActor | null;
  createdAt?: string | null;
};

type WorkflowState = {
  status: WorkflowStatus;
  priority: WorkflowPriority;
  createdBy: WorkflowActor | null;
  assignedTo: WorkflowActor | null;
  reviewedBy: WorkflowActor | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  publishedAt: string | null;
  scheduledFor: string | null;
  dueAt: string | null;
  rejectionReason: string;
  comments: WorkflowCommentItem[];
};

type StoryActivityItem = {
  id?: string;
  action?: string;
  fromStatus?: WorkflowStatus | null;
  toStatus?: WorkflowStatus | null;
  actor?: WorkflowActor | null;
  message?: string;
  createdAt?: string | null;
  source?: 'audit' | 'derived';
};

type AssignableUserOption = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
};

const categories = ['General', ...NEWS_CATEGORIES.map((category) => category.nameEn)];
const THUMBNAIL_MAX_SIZE = 5 * 1024 * 1024;
const WORKFLOW_PRIORITIES: WorkflowPriority[] = ['low', 'normal', 'high', 'urgent'];

const STATUS_TO_ACTION: Partial<Record<WorkflowStatus, ContentTransitionAction>> = {
  submitted: 'submit',
  assigned: 'assign',
  in_review: 'start_review',
  copy_edit: 'move_to_copy_edit',
  changes_requested: 'request_changes',
  ready_for_approval: 'mark_ready_for_approval',
  approved: 'approve',
  rejected: 'reject',
  scheduled: 'schedule',
  published: 'publish',
  archived: 'archive',
};

const ACTION_LABELS: Record<ContentTransitionAction, string> = {
  submit: 'Submit For Review',
  assign: 'Assign',
  start_review: 'Start Review',
  move_to_copy_edit: 'Move To Copy Edit',
  request_changes: 'Request Changes',
  mark_ready_for_approval: 'Mark Ready For Approval',
  approve: 'Approve',
  reject: 'Reject',
  schedule: 'Schedule',
  publish: 'Publish',
  archive: 'Archive',
};

const initialFormData: StoryFormData = {
  title: '',
  caption: '',
  thumbnail: '',
  mediaType: 'image',
  mediaUrl: '',
  linkUrl: '',
  linkLabel: '',
  category: 'General',
  author: 'Desk',
  locationTag: '',
  sourceInfo: '',
  sourceConfidential: false,
  reporterNotes: '',
  proofreadComplete: false,
  factCheckStatus: 'pending',
  headlineStatus: 'pending',
  imageOptimizationStatus: 'pending',
  copyEditorNotes: '',
  returnForChangesReason: '',
  durationSeconds: '6',
  priority: '0',
  views: '0',
};

const EMPTY_WORKFLOW: WorkflowState = {
  status: 'draft',
  priority: 'normal',
  createdBy: null,
  assignedTo: null,
  reviewedBy: null,
  submittedAt: null,
  approvedAt: null,
  rejectedAt: null,
  publishedAt: null,
  scheduledFor: null,
  dueAt: null,
  rejectionReason: '',
  comments: [],
};

function buildFormSnapshot(formData: StoryFormData, thumbnailPreview: string) {
  return JSON.stringify({
    ...formData,
    thumbnailPreview: thumbnailPreview.trim(),
  });
}

function formatDateTime(value: string | null | undefined) {
  return value ? formatUiDateTime(value, '') : '';
}

function formatWorkflowStatus(status: WorkflowStatus) {
  return status.replace(/_/g, ' ');
}

function formatActivityActionLabel(action: string | undefined) {
  return String(action || 'activity')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatNewsroomRoleLabel(role: AdminRole | undefined) {
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'admin':
      return 'Admin';
    case 'copy_editor':
      return 'Copy Editor';
    case 'reporter':
      return 'Reporter';
    default:
      return 'Team';
  }
}

function getWorkflowToneClass(status: WorkflowStatus) {
  switch (status) {
    case 'published':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'ready_for_approval':
    case 'approved':
    case 'scheduled':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'submitted':
    case 'assigned':
    case 'in_review':
    case 'copy_edit':
    case 'changes_requested':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'rejected':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'archived':
      return 'border-gray-300 bg-gray-100 text-gray-700';
    case 'draft':
    default:
      return 'border-gray-200 bg-gray-100 text-gray-700';
  }
}

function getWorkflowFeedbackToneClass(tone: WorkflowFeedbackTone) {
  switch (tone) {
    case 'danger':
      return 'border-red-200 bg-red-50 text-red-900';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'info':
      return 'border-blue-200 bg-blue-50 text-blue-900';
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    case 'neutral':
    default:
      return 'border-gray-200 bg-white text-gray-900';
  }
}

function WorkflowPill({ status }: { status: WorkflowStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${getWorkflowToneClass(status)}`}
    >
      {formatWorkflowStatus(status)}
    </span>
  );
}

function normalizeWorkflowState(input: unknown): WorkflowState {
  const source = typeof input === 'object' && input ? (input as Record<string, unknown>) : {};
  const comments = Array.isArray(source.comments)
    ? source.comments.map((entry) => {
        const comment = typeof entry === 'object' && entry ? (entry as Record<string, unknown>) : {};
        const author =
          typeof comment.author === 'object' && comment.author
            ? (comment.author as Record<string, unknown>)
            : {};

        return {
          id: typeof comment.id === 'string' ? comment.id : '',
          body: typeof comment.body === 'string' ? comment.body : '',
          kind: typeof comment.kind === 'string' ? comment.kind : 'comment',
          author: {
            id: typeof author.id === 'string' ? author.id : '',
            name: typeof author.name === 'string' ? author.name : '',
            email: typeof author.email === 'string' ? author.email : '',
            role: typeof author.role === 'string' ? (author.role as AdminRole) : undefined,
          },
          createdAt: typeof comment.createdAt === 'string' ? comment.createdAt : null,
        } satisfies WorkflowCommentItem;
      })
    : [];

  const toActor = (value: unknown): WorkflowActor | null => {
    const actor = typeof value === 'object' && value ? (value as Record<string, unknown>) : null;
    if (!actor) return null;

    const id = typeof actor.id === 'string' ? actor.id : '';
    const name = typeof actor.name === 'string' ? actor.name : '';
    const email = typeof actor.email === 'string' ? actor.email : '';
    const role = typeof actor.role === 'string' ? (actor.role as AdminRole) : undefined;

    if (!id && !email && !name) {
      return null;
    }

    return { id, name, email, role };
  };

  return {
    status: typeof source.status === 'string' ? (source.status as WorkflowStatus) : 'draft',
    priority: typeof source.priority === 'string' ? (source.priority as WorkflowPriority) : 'normal',
    createdBy: toActor(source.createdBy),
    assignedTo: toActor(source.assignedTo),
    reviewedBy: toActor(source.reviewedBy),
    submittedAt: typeof source.submittedAt === 'string' ? source.submittedAt : null,
    approvedAt: typeof source.approvedAt === 'string' ? source.approvedAt : null,
    rejectedAt: typeof source.rejectedAt === 'string' ? source.rejectedAt : null,
    publishedAt: typeof source.publishedAt === 'string' ? source.publishedAt : null,
    scheduledFor: typeof source.scheduledFor === 'string' ? source.scheduledFor : null,
    dueAt: typeof source.dueAt === 'string' ? source.dueAt : null,
    rejectionReason: typeof source.rejectionReason === 'string' ? source.rejectionReason : '',
    comments,
  };
}

function toDateTimeInputValue(value: string | null | undefined) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getDate()}`.padStart(2, '0');
  const hours = `${parsed.getHours()}`.padStart(2, '0');
  const minutes = `${parsed.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseWorkflowActionDate(value: string) {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export default function EditStoryPage() {
  const { data: session } = useSession();
  const params = useParams<{ id: string }>();
  const routeId = Array.isArray(params?.id) ? params.id[0] || '' : params?.id || '';
  const storyId = decodeURIComponent(routeId);

  const [formData, setFormData] = useState<StoryFormData>(initialFormData);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState('');
  const [savedFormSnapshot, setSavedFormSnapshot] = useState('');
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [workflow, setWorkflow] = useState<WorkflowState>(EMPTY_WORKFLOW);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUserOption[]>([]);
  const [isLoadingAssignableUsers, setIsLoadingAssignableUsers] = useState(false);
  const [workflowAssigneeId, setWorkflowAssigneeId] = useState('');
  const [workflowComment, setWorkflowComment] = useState('');
  const [workflowRejectionReason, setWorkflowRejectionReason] = useState('');
  const [workflowScheduledFor, setWorkflowScheduledFor] = useState('');
  const [workflowDueAt, setWorkflowDueAt] = useState('');
  const [workflowPriority, setWorkflowPriority] = useState<WorkflowPriority>('normal');
  const [runningWorkflowAction, setRunningWorkflowAction] = useState<ContentTransitionAction | ''>('');
  const [storyActivity, setStoryActivity] = useState<StoryActivityItem[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  const previewThumbnail = useMemo(
    () => thumbnailPreview || formData.thumbnail.trim(),
    [formData.thumbnail, thumbnailPreview]
  );

  const permissionUser = useMemo(() => {
    const sessionUser = session?.user;
    const email = sessionUser?.email?.trim() || '';
    const role = sessionUser?.role;

    if (!sessionUser || !email || !isAdminRole(role)) {
      return null;
    }

    return {
      id: sessionUser.userId || sessionUser.id || email,
      email,
      name: sessionUser.name?.trim() || email.split('@')[0] || 'Admin',
      role,
    };
  }, [session]);

  const workflowPermissionRecord = useMemo(
    () => ({
      legacyAuthorName: formData.author,
      workflow,
    }),
    [formData.author, workflow]
  );

  const canUseWorkflowDesk = canManageWorkflowAssignments(permissionUser?.role);
  const canSaveStory = Boolean(permissionUser);
  const canEditCopyDeskMeta = Boolean(
    permissionUser?.role &&
      (permissionUser.role === 'admin' ||
        permissionUser.role === 'super_admin' ||
        isCopyEditorRole(permissionUser.role))
  );
  const isReporterView = isReporterDeskRole(permissionUser?.role);
  const hasUnsavedChanges = Boolean(thumbnailFile) || buildFormSnapshot(formData, previewThumbnail) !== savedFormSnapshot;

  const availableWorkflowActions = useMemo(() => {
    if (!permissionUser) return [] as ContentTransitionAction[];

    return getAllowedWorkflowTransitions(workflow.status)
      .map((status) => STATUS_TO_ACTION[status])
      .filter((action): action is ContentTransitionAction => Boolean(action))
      .filter((action) =>
        canTransitionContent(permissionUser, workflowPermissionRecord, action)
      );
  }, [permissionUser, workflow.status, workflowPermissionRecord]);

  const recentWorkflowComments = useMemo(
    () =>
      [...workflow.comments]
        .filter((comment) => comment.body?.trim())
        .slice(-5)
        .reverse(),
    [workflow.comments]
  );

  const workflowFeedback = useMemo(
    () =>
      buildWorkflowFeedbackSummary({
        contentLabel: 'Story',
        status: workflow.status,
        assignedToName: workflow.assignedTo?.name || workflow.assignedTo?.email || '',
        reviewedByName: workflow.reviewedBy?.name || workflow.reviewedBy?.email || '',
        rejectionReason: workflow.rejectionReason,
        returnForChangesReason: formData.returnForChangesReason,
        copyEditorNotes: formData.copyEditorNotes,
        workflowComments: workflow.comments,
      }),
    [
      formData.copyEditorNotes,
      formData.returnForChangesReason,
      workflow.assignedTo?.email,
      workflow.assignedTo?.name,
      workflow.comments,
      workflow.rejectionReason,
      workflow.reviewedBy?.email,
      workflow.reviewedBy?.name,
      workflow.status,
    ]
  );

  const fetchStory = useCallback(async () => {
    if (!storyId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/stories/${encodeURIComponent(storyId)}`, {
        headers: {
          ...getAuthHeader(),
        },
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load story');
      }

      const story = data.data as Record<string, unknown>;
      const nextForm = {
        title: String(story.title || ''),
        caption: String(story.caption || ''),
        thumbnail: String(story.thumbnail || ''),
        mediaType: story.mediaType === 'video' ? 'video' : 'image',
        mediaUrl: String(story.mediaUrl || ''),
        linkUrl: String(story.linkUrl || ''),
        linkLabel: String(story.linkLabel || ''),
        category: String(story.category || 'General'),
        author: String(story.author || 'Desk'),
        locationTag: String((story.reporterMeta as StoryReporterMeta | undefined)?.locationTag || ''),
        sourceInfo: String((story.reporterMeta as StoryReporterMeta | undefined)?.sourceInfo || ''),
        sourceConfidential: Boolean(
          (story.reporterMeta as StoryReporterMeta | undefined)?.sourceConfidential
        ),
        reporterNotes: String(
          (story.reporterMeta as StoryReporterMeta | undefined)?.reporterNotes || ''
        ),
        proofreadComplete: Boolean(
          (story.copyEditorMeta as StoryCopyEditorMeta | undefined)?.proofreadComplete
        ),
        factCheckStatus:
          (story.copyEditorMeta as StoryCopyEditorMeta | undefined)?.factCheckStatus ||
          'pending',
        headlineStatus:
          (story.copyEditorMeta as StoryCopyEditorMeta | undefined)?.headlineStatus ||
          'pending',
        imageOptimizationStatus:
          (story.copyEditorMeta as StoryCopyEditorMeta | undefined)?.imageOptimizationStatus ||
          'pending',
        copyEditorNotes: String(
          (story.copyEditorMeta as StoryCopyEditorMeta | undefined)?.copyEditorNotes || ''
        ),
        returnForChangesReason: String(
          (story.copyEditorMeta as StoryCopyEditorMeta | undefined)
            ?.returnForChangesReason || ''
        ),
        durationSeconds: String(story.durationSeconds ?? 6),
        priority: String(story.priority ?? 0),
        views: String(story.views ?? 0),
      } satisfies StoryFormData;
      const nextWorkflow = normalizeWorkflowState(story.workflow);

      setFormData(nextForm);
      setThumbnailFile(null);
      setThumbnailPreview(String(story.thumbnail || ''));
      setSavedFormSnapshot(buildFormSnapshot(nextForm, String(story.thumbnail || '')));
      setWorkflow(nextWorkflow);
      setWorkflowPriority(nextWorkflow.priority);
      setWorkflowAssigneeId(nextWorkflow.assignedTo?.id || '');
      setWorkflowScheduledFor(toDateTimeInputValue(nextWorkflow.scheduledFor));
      setWorkflowDueAt(toDateTimeInputValue(nextWorkflow.dueAt));
      setWorkflowRejectionReason(nextWorkflow.rejectionReason || '');
      setWorkflowComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load story');
    } finally {
      setIsLoading(false);
    }
  }, [storyId]);

  const fetchStoryActivity = useCallback(async () => {
    if (!storyId) {
      setStoryActivity([]);
      return;
    }

    setIsLoadingActivity(true);
    try {
      const response = await fetch(`/api/admin/stories/${encodeURIComponent(storyId)}/activity`, {
        headers: {
          ...getAuthHeader(),
        },
        cache: 'no-store',
      });
      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        data?: StoryActivityItem[];
      };

      if (!response.ok || !data.success || !Array.isArray(data.data)) {
        setStoryActivity([]);
        return;
      }

      setStoryActivity(data.data);
    } catch {
      setStoryActivity([]);
    } finally {
      setIsLoadingActivity(false);
    }
  }, [storyId]);

  const fetchAssignableUsers = useCallback(async () => {
    if (!canUseWorkflowDesk) {
      setAssignableUsers([]);
      return;
    }

    setIsLoadingAssignableUsers(true);
    try {
      const response = await fetch('/api/admin/team/options', {
        headers: { ...getAuthHeader() },
        cache: 'no-store',
      });
      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        data?: AssignableUserOption[];
      };

      if (!response.ok || !data.success || !Array.isArray(data.data)) {
        setAssignableUsers([]);
        return;
      }

      setAssignableUsers(data.data);
    } catch {
      setAssignableUsers([]);
    } finally {
      setIsLoadingAssignableUsers(false);
    }
  }, [canUseWorkflowDesk]);

  useEffect(() => {
    void fetchStory();
    void fetchStoryActivity();
  }, [fetchStory, fetchStoryActivity]);

  useEffect(() => {
    void fetchAssignableUsers();
  }, [fetchAssignableUsers]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleThumbnailFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Thumbnail must be an image file');
      return;
    }

    if (file.size > THUMBNAIL_MAX_SIZE) {
      setError('Thumbnail image size must be less than 5MB');
      return;
    }

    setError('');
    setThumbnailFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      setThumbnailPreview((event.target?.result as string) || '');
    };
    reader.readAsDataURL(file);
  };

  const uploadThumbnail = async () => {
    if (!thumbnailFile) return formData.thumbnail.trim();

    setIsUploadingThumbnail(true);
    try {
      const body = new FormData();
      body.append('file', thumbnailFile);
      body.append('purpose', 'story-thumbnail');

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
        },
        body,
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload thumbnail');
      }

      return String(data.data?.url || '');
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      if (!formData.title.trim()) {
        setError('Story title is required');
        setIsSaving(false);
        return;
      }

      const thumbnail = await uploadThumbnail();
      if (!thumbnail) {
        setError('Please provide a story thumbnail');
        setIsSaving(false);
        return;
      }

      const durationSeconds = Number.parseInt(formData.durationSeconds, 10);
      const priority = Number.parseInt(formData.priority, 10);
      const views = Number.parseInt(formData.views, 10);

      if (!Number.isFinite(durationSeconds) || durationSeconds < 2 || durationSeconds > 180) {
        setError('Duration must be between 2 and 180 seconds');
        setIsSaving(false);
        return;
      }

      if (!Number.isFinite(priority)) {
        setError('Priority must be a valid number');
        setIsSaving(false);
        return;
      }

      if (!Number.isFinite(views) || views < 0) {
        setError('Views must be a valid non-negative number');
        setIsSaving(false);
        return;
      }

      if (formData.mediaType === 'video' && !formData.mediaUrl.trim()) {
        setError('Video media URL is required for video stories');
        setIsSaving(false);
        return;
      }

      const response = await fetch(`/api/admin/stories/${storyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          caption: formData.caption.trim(),
          thumbnail: thumbnail.trim(),
          mediaType: formData.mediaType,
          mediaUrl: formData.mediaUrl.trim(),
          linkUrl: formData.linkUrl.trim(),
          linkLabel: formData.linkLabel.trim(),
          category: formData.category,
          author: formData.author.trim() || 'Desk',
          reporterMeta: {
            locationTag: formData.locationTag,
            sourceInfo: formData.sourceInfo,
            sourceConfidential: formData.sourceConfidential,
            reporterNotes: formData.reporterNotes,
          },
          copyEditorMeta: {
            proofreadComplete: formData.proofreadComplete,
            factCheckStatus: formData.factCheckStatus,
            headlineStatus: formData.headlineStatus,
            imageOptimizationStatus: formData.imageOptimizationStatus,
            copyEditorNotes: formData.copyEditorNotes,
            returnForChangesReason: formData.returnForChangesReason,
          },
          durationSeconds,
          priority,
          views,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update story');
      }

      setSuccess('Story updated successfully.');
      await fetchStory();
      await fetchStoryActivity();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update story');
    } finally {
      setIsSaving(false);
    }
  };

  const handleWorkflowAction = async (action: ContentTransitionAction) => {
    setError('');
    setSuccess('');

    if (hasUnsavedChanges) {
      setError('Save story changes before moving the workflow.');
      return;
    }

    if (action === 'assign' && !workflowAssigneeId.trim()) {
      setError('Select an assignee before assigning this story.');
      return;
    }

    if (action === 'reject' && !workflowRejectionReason.trim()) {
      setError('Add a rejection reason before rejecting this story.');
      return;
    }

    if (action === 'schedule' && !workflowScheduledFor.trim()) {
      setError('Choose a publish time before scheduling this story.');
      return;
    }

    const scheduledFor = parseWorkflowActionDate(workflowScheduledFor);
    const dueAt = parseWorkflowActionDate(workflowDueAt);

    if (workflowScheduledFor && !scheduledFor) {
      setError('Scheduled publish time is invalid.');
      return;
    }

    if (workflowDueAt && !dueAt) {
      setError('Due date is invalid.');
      return;
    }

    setRunningWorkflowAction(action);
    try {
      const response = await fetch(`/api/admin/stories/${encodeURIComponent(storyId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          action,
          assignedToId: workflowAssigneeId || undefined,
          scheduledFor: scheduledFor || undefined,
          dueAt: dueAt || undefined,
          priority: workflowPriority,
          rejectionReason: workflowRejectionReason.trim() || undefined,
          comment: workflowComment.trim() || undefined,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        message?: string;
      };

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to update workflow');
        return;
      }

      setWorkflowComment('');
      if (action !== 'reject') {
        setWorkflowRejectionReason('');
      }
      setSuccess(data.message || `${ACTION_LABELS[action]} completed.`);
      await fetchStory();
      await fetchStoryActivity();
    } catch {
      setError('Failed to update workflow. Please try again.');
    } finally {
      setRunningWorkflowAction('');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="flex h-[50vh] items-center justify-center rounded-xl border border-gray-200 bg-white">
          <Loader2 className="h-7 w-7 animate-spin text-spanish-red" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Link
        href="/admin/stories"
        className="mb-6 inline-flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Stories
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-4xl"
      >
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">Edit Story</h1>
                <WorkflowPill status={workflow.status} />
                {hasUnsavedChanges ? (
                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    Unsaved changes
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-gray-600">Refine story visuals, workflow, and desk status</p>
            </div>
          </div>

          {error ? (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          ) : null}

          {success ? (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
              <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{success}</p>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Workflow</p>
                  <p className="mt-1 text-sm text-gray-700">
                    Move this story through the newsroom queue without leaving the editor.
                  </p>
                </div>
                <WorkflowPill status={workflow.status} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Created By</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {workflow.createdBy?.name || workflow.createdBy?.email || 'Unknown'}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Assigned To</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {workflow.assignedTo?.name || workflow.assignedTo?.email || 'Unassigned'}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Reviewed By</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {workflow.reviewedBy?.name || workflow.reviewedBy?.email || 'Not started'}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Priority</p>
                  <p className="mt-1 text-sm font-medium capitalize text-gray-900">{workflowPriority}</p>
                </div>
              </div>

              <div className={`rounded-lg border p-4 ${getWorkflowFeedbackToneClass(workflowFeedback.tone)}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{workflowFeedback.badge}</p>
                    <p className="mt-1 text-sm leading-6">{workflowFeedback.summary}</p>
                  </div>
                  {workflowFeedback.readyToResubmit ? (
                    <span className="inline-flex items-center rounded-full border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700">
                      Ready to resubmit
                    </span>
                  ) : workflowFeedback.waitingOnDesk ? (
                    <span className="inline-flex items-center rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700">
                      With desk
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-6">
                  <span className="font-semibold">Next action:</span> {workflowFeedback.nextAction}
                </p>
                {workflowFeedback.highlightedNote ? (
                  <div className="mt-3 rounded-lg border border-white/70 bg-white/80 p-3 text-sm text-gray-700">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      {workflowFeedback.highlightedNoteLabel || 'Desk feedback'}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{workflowFeedback.highlightedNote}</p>
                    {workflowFeedback.highlightedBy ? (
                      <p className="mt-2 text-xs text-gray-500">
                        From {workflowFeedback.highlightedBy}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {canUseWorkflowDesk ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-900">Assignee</label>
                    <select
                      value={workflowAssigneeId}
                      onChange={(event) => setWorkflowAssigneeId(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-spanish-red focus:outline-none"
                    >
                      <option value="">
                        {isLoadingAssignableUsers ? 'Loading team...' : 'Select assignee'}
                      </option>
                      {assignableUsers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} ({formatNewsroomRoleLabel(member.role)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-900">Priority</label>
                    <select
                      value={workflowPriority}
                      onChange={(event) => setWorkflowPriority(event.target.value as WorkflowPriority)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 capitalize focus:border-spanish-red focus:outline-none"
                    >
                      {WORKFLOW_PRIORITIES.map((priority) => (
                        <option key={priority} value={priority}>
                          {priority}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-900">Due Date</label>
                    <input
                      type="datetime-local"
                      value={workflowDueAt}
                      onChange={(event) => setWorkflowDueAt(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-spanish-red focus:outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-900">Schedule Publish Time</label>
                    <input
                      type="datetime-local"
                      value={workflowScheduledFor}
                      onChange={(event) => setWorkflowScheduledFor(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-spanish-red focus:outline-none"
                    />
                  </div>
                </div>
              ) : null}

              {availableWorkflowActions.includes('reject') || workflow.rejectionReason ? (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-900">Rejection Reason</label>
                  <textarea
                    value={workflowRejectionReason}
                    onChange={(event) => setWorkflowRejectionReason(event.target.value)}
                    rows={3}
                    placeholder="Explain what should change before this story can continue."
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-spanish-red focus:outline-none"
                  />
                </div>
              ) : null}

              {availableWorkflowActions.length > 0 ? (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-900">Workflow Note</label>
                  <textarea
                    value={workflowComment}
                    onChange={(event) => setWorkflowComment(event.target.value)}
                    rows={3}
                    placeholder="Add handoff context, review notes, or publish instructions."
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-spanish-red focus:outline-none"
                  />
                </div>
              ) : null}

              {availableWorkflowActions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {availableWorkflowActions.map((action) => {
                    const needsAssignee = action === 'assign' && !workflowAssigneeId.trim();
                    const needsReason = action === 'reject' && !workflowRejectionReason.trim();
                    const needsSchedule = action === 'schedule' && !workflowScheduledFor.trim();
                    const disabled =
                      Boolean(runningWorkflowAction) ||
                      hasUnsavedChanges ||
                      needsAssignee ||
                      needsReason ||
                      needsSchedule;

                    return (
                      <button
                        key={action}
                        type="button"
                        onClick={() => void handleWorkflowAction(action)}
                        disabled={disabled}
                        className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {runningWorkflowAction === action ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {ACTION_LABELS[action]}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  No workflow transition is available for your role from the current state.
                </p>
              )}

              {recentWorkflowComments.length > 0 ? (
                <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-sm font-semibold text-gray-900">Recent Workflow Notes</p>
                  <div className="space-y-3">
                    {recentWorkflowComments.map((comment) => (
                      <div
                        key={comment.id || `${comment.createdAt || 'comment'}-${comment.body || ''}`}
                        className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span className="font-semibold text-gray-700">
                            {comment.author?.name || comment.author?.email || 'Team'}
                          </span>
                          <span>{formatNewsroomRoleLabel(comment.author?.role)}</span>
                          {comment.createdAt ? (
                            <span>{formatDateTime(comment.createdAt)}</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-gray-700">{comment.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">
                Story Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">Video Script</label>
              <textarea
                name="caption"
                value={formData.caption}
                onChange={handleInputChange}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {!isReporterView ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Story Type
                  </label>
                  <select
                    name="mediaType"
                    value={formData.mediaType}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                  >
                    <option value="image">Image Story</option>
                    <option value="video">Video Story</option>
                  </select>
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  Category
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">Thumbnail URL</label>
              <input
                type="url"
                name="thumbnail"
                value={formData.thumbnail}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">
                Replace Thumbnail (image)
              </label>
              <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-4 py-5 transition-colors hover:border-primary-600 hover:bg-gray-50">
                <span className="flex flex-col items-center gap-1 text-center">
                  <ImageIcon className="h-5 w-5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Click to upload</span>
                  <span className="text-xs text-gray-500">Images/Videos - All formats up to 5MB</span>
                </span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleThumbnailFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {previewThumbnail ? (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                {/* Admin preview supports blob/object URLs from file input. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewThumbnail}
                  alt="Story thumbnail preview"
                  className="h-64 w-full object-cover"
                />
              </div>
            ) : null}

            {formData.mediaType === 'video' ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  Video URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  name="mediaUrl"
                  value={formData.mediaUrl}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                  required
                />
              </div>
            ) : null}

            {!isReporterView ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Link URL
                  </label>
                  <input
                    type="text"
                    name="linkUrl"
                    value={formData.linkUrl}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Link Label
                  </label>
                  <input
                    type="text"
                    name="linkLabel"
                    value={formData.linkLabel}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                  />
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  Location Tag
                </label>
                <input
                  type="text"
                  name="locationTag"
                  value={formData.locationTag}
                  onChange={handleInputChange}
                  placeholder="Bhopal, MP"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                />
              </div>
            </div>

            {!isReporterView ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-900">Author</label>
                  <input
                    type="text"
                    name="author"
                    value={formData.author}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Duration (sec)
                  </label>
                  <input
                    type="number"
                    name="durationSeconds"
                    value={formData.durationSeconds}
                    onChange={handleInputChange}
                    min="2"
                    max="180"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">Priority</label>
                  <input
                    type="number"
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">Views</label>
                  <input
                    type="number"
                    name="views"
                    value={formData.views}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                  />
                </div>
              </div>
            ) : null}

            {!isReporterView ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Source Information</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Source and handoff details that move with this story through the desk.
                  </p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Source Info
                  </label>
                  <textarea
                    name="sourceInfo"
                    value={formData.sourceInfo}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Source, bureau, agency, or submission background."
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                  />
                </div>
                <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="sourceConfidential"
                    checked={formData.sourceConfidential}
                    onChange={handleInputChange}
                    className="h-4 w-4 rounded border-gray-300 text-spanish-red focus:ring-spanish-red"
                  />
                  <span className="text-sm text-gray-700">
                    Source is confidential and should remain internal
                  </span>
                </label>
              </div>
            ) : null}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">
                Reporter Notes
              </label>
              <textarea
                name="reporterNotes"
                value={formData.reporterNotes}
                onChange={handleInputChange}
                rows={3}
                placeholder="Desk notes, context, verification leads, or packaging hints."
                className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
              />
            </div>

            {canEditCopyDeskMeta ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Copy Editor Review</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Quality checks before this story goes back to admin approval.
                  </p>
                </div>
                <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="proofreadComplete"
                    checked={formData.proofreadComplete}
                    onChange={handleInputChange}
                    className="h-4 w-4 rounded border-gray-300 text-spanish-red focus:ring-spanish-red"
                  />
                  <span className="text-sm text-gray-700">
                    Proofread is complete and ready for desk review
                  </span>
                </label>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900">
                      Fact Check
                    </label>
                    <select
                      name="factCheckStatus"
                      value={formData.factCheckStatus}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                    >
                      {FACT_CHECK_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900">
                      Headline
                    </label>
                    <select
                      name="headlineStatus"
                      value={formData.headlineStatus}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                    >
                      {HEADLINE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900">
                      Image
                    </label>
                    <select
                      name="imageOptimizationStatus"
                      value={formData.imageOptimizationStatus}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                    >
                      {IMAGE_OPTIMIZATION_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Copy Editor Notes
                  </label>
                  <textarea
                    name="copyEditorNotes"
                    value={formData.copyEditorNotes}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Visual cleanup, headline direction, and fact-check notes."
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Return For Changes Reason
                  </label>
                  <textarea
                    name="returnForChangesReason"
                    value={formData.returnForChangesReason}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder={
                      isReporterView
                        ? 'Visible to desk roles when changes are requested.'
                        : 'Explain what must go back to the reporter before approval.'
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-primary-600 focus:outline-none"
                  />
                </div>
              </div>
            ) : null}

            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Activity Timeline</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Saves and workflow changes land here so the desk can see what happened.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void fetchStoryActivity()}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                >
                  {isLoadingActivity ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
              {isLoadingActivity ? (
                <p className="text-sm text-gray-600">Loading activity...</p>
              ) : null}
              {!isLoadingActivity && storyActivity.length === 0 ? (
                <p className="text-sm text-gray-600">
                  No story activity yet. Save or move workflow to start the timeline.
                </p>
              ) : null}
              {!isLoadingActivity && storyActivity.length > 0 ? (
                <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                  {storyActivity.map((activity, index) => (
                    <div
                      key={activity.id || `${activity.action || 'activity'}-${activity.createdAt || index}`}
                      className="rounded-lg border border-gray-200 bg-white p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-700">
                              {formatActivityActionLabel(activity.action)}
                            </span>
                            {activity.toStatus ? <WorkflowPill status={activity.toStatus} /> : null}
                            {activity.source === 'derived' ? (
                              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                                Derived
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm text-gray-800">
                            {activity.message || 'Story activity recorded.'}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span className="font-semibold text-gray-700">
                              {activity.actor?.name || activity.actor?.email || 'System'}
                            </span>
                            {activity.actor?.role ? (
                              <span>{formatNewsroomRoleLabel(activity.actor.role)}</span>
                            ) : null}
                            {activity.fromStatus && activity.toStatus ? (
                              <span>
                                {formatWorkflowStatus(activity.fromStatus)} {'->'}{' '}
                                {formatWorkflowStatus(activity.toStatus)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          {activity.createdAt ? formatDateTime(activity.createdAt) : 'Unknown time'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {canSaveStory ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={isSaving || isUploadingThumbnail}
                  className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-3 font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving || isUploadingThumbnail ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {isUploadingThumbnail ? 'Uploading...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5" />
                      Save Changes
                    </>
                  )}
                </button>

                <Link
                  href="/admin/stories"
                  className="rounded-lg border border-gray-300 px-5 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-100"
                >
                  Cancel
                </Link>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                Viewer mode: you can review the story and timeline, but editing is disabled.
              </div>
            )}
          </form>
        </div>
      </motion.div>
    </div>
  );
}
