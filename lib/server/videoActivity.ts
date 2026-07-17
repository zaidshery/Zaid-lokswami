import 'server-only';

import type { AdminSessionIdentity } from '@/lib/auth/admin';
import type { WorkflowActorRef, WorkflowStatus } from '@/lib/workflow/types';
import { resolveVideoWorkflow } from '@/lib/workflow/video';
import {
  listContentActivity,
  recordContentActivity,
  type ContentActivityActor,
  type ContentActivityItem,
} from '@/lib/server/contentActivity';

type VideoActivitySource = {
  _id?: unknown;
  isPublished?: unknown;
  publishedAt?: unknown;
  updatedAt?: unknown;
  workflow?: unknown;
};

type BuildVideoActivityMessageInput = {
  action: string;
  toStatus?: WorkflowStatus | null;
  assignedTo?: WorkflowActorRef | null;
  rejectionReason?: string | null;
};

function parseDate(value: unknown) {
  if (!value) return null;

  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toSerializableActor(actor: WorkflowActorRef | null | undefined): ContentActivityActor | null {
  if (!actor?.id && !actor?.name && !actor?.email) {
    return null;
  }

  return {
    id: actor?.id || '',
    name: actor?.name || '',
    email: actor?.email || '',
    role: actor?.role || null,
  };
}

function createDerivedActivity(
  input: Omit<ContentActivityItem, 'source'>
): ContentActivityItem {
  return {
    ...input,
    source: 'derived',
  };
}

export function buildVideoActivityMessage(input: BuildVideoActivityMessageInput) {
  switch (input.action) {
    case 'created':
      if (input.toStatus === 'submitted') return 'Video created and submitted for review.';
      if (input.toStatus === 'published') return 'Video created and published.';
      return 'Video draft created.';
    case 'saved':
      return 'Video updated.';
    case 'submit':
      return 'Video submitted for review.';
    case 'assign':
      return input.assignedTo?.name
        ? `Video assigned to ${input.assignedTo.name}.`
        : 'Video assigned to the desk.';
    case 'start_review':
      return 'Video review started.';
    case 'move_to_copy_edit':
      return 'Video moved to copy edit.';
    case 'request_changes':
      return input.rejectionReason?.trim()
        ? `Changes requested: ${input.rejectionReason.trim()}`
        : 'Video returned for reporting or desk changes.';
    case 'mark_ready_for_approval':
      return 'Video marked ready for admin approval.';
    case 'approve':
      return 'Video approved for publish.';
    case 'reject':
      return input.rejectionReason?.trim()
        ? `Video rejected: ${input.rejectionReason.trim()}`
        : 'Video rejected and returned for changes.';
    case 'schedule':
      return 'Video scheduled for publish.';
    case 'publish':
      return 'Video published.';
    case 'fast_publish':
      return 'Video urgently published with an audited desk exception.';
    case 'archive':
      return 'Video archived.';
    default:
      return 'Video activity recorded.';
  }
}

export async function recordVideoActivity(input: {
  videoId: string;
  actor?: Pick<AdminSessionIdentity, 'id' | 'name' | 'email' | 'role'> | null;
  action: string;
  fromStatus?: WorkflowStatus | null;
  toStatus?: WorkflowStatus | null;
  message?: string;
  metadata?: Record<string, unknown>;
}) {
  await recordContentActivity({
    contentType: 'video',
    contentId: input.videoId,
    action: input.action,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    actor: input.actor,
    message: input.message,
    metadata: input.metadata,
  });
}

export function deriveVideoActivity(video: VideoActivitySource | null | undefined, limit = 30) {
  if (!video) {
    return [] as ContentActivityItem[];
  }

  const videoId = String(video._id || '').trim();
  const workflow = resolveVideoWorkflow(video);
  const timeline: ContentActivityItem[] = [];
  const seen = new Set<string>();

  const pushIfValid = (entry: Omit<ContentActivityItem, 'source'>) => {
    const createdAt = parseDate(entry.createdAt)?.toISOString();
    if (!createdAt) return;

    const dedupeKey = `${entry.action}:${createdAt}:${entry.message}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    timeline.push(
      createDerivedActivity({
        ...entry,
        createdAt,
      })
    );
  };

  workflow.comments.forEach((comment, index) => {
    pushIfValid({
      id: comment.id || `derived-comment-${comment.createdAt.toISOString()}-${index}`,
      contentType: 'video',
      contentId: videoId,
      parentId: '',
      action: comment.kind,
      fromStatus: null,
      toStatus: workflow.status,
      actor: toSerializableActor(comment.author),
      message: comment.body,
      metadata: {
        kind: comment.kind,
      },
      createdAt: comment.createdAt.toISOString(),
    });
  });

  if (workflow.submittedAt) {
    pushIfValid({
      id: `derived-submit-${workflow.submittedAt.toISOString()}`,
      contentType: 'video',
      contentId: videoId,
      parentId: '',
      action: 'submit',
      fromStatus: 'draft',
      toStatus: 'submitted',
      actor: toSerializableActor(workflow.createdBy),
      message: buildVideoActivityMessage({ action: 'submit', toStatus: 'submitted' }),
      metadata: {},
      createdAt: workflow.submittedAt.toISOString(),
    });
  }

  if (workflow.approvedAt) {
    pushIfValid({
      id: `derived-approve-${workflow.approvedAt.toISOString()}`,
      contentType: 'video',
      contentId: videoId,
      parentId: '',
      action: 'approve',
      fromStatus: 'ready_for_approval',
      toStatus: 'approved',
      actor: toSerializableActor(workflow.reviewedBy),
      message: buildVideoActivityMessage({ action: 'approve', toStatus: 'approved' }),
      metadata: {},
      createdAt: workflow.approvedAt.toISOString(),
    });
  }

  if (workflow.rejectedAt) {
    pushIfValid({
      id: `derived-reject-${workflow.rejectedAt.toISOString()}`,
      contentType: 'video',
      contentId: videoId,
      parentId: '',
      action: 'reject',
      fromStatus: null,
      toStatus: 'rejected',
      actor: toSerializableActor(workflow.reviewedBy),
      message: buildVideoActivityMessage({
        action: 'reject',
        toStatus: 'rejected',
        rejectionReason: workflow.rejectionReason,
      }),
      metadata: {
        rejectionReason: workflow.rejectionReason,
      },
      createdAt: workflow.rejectedAt.toISOString(),
    });
  }

  if (workflow.publishedAt) {
    pushIfValid({
      id: `derived-publish-${workflow.publishedAt.toISOString()}`,
      contentType: 'video',
      contentId: videoId,
      parentId: '',
      action: 'publish',
      fromStatus: workflow.scheduledFor ? 'scheduled' : 'approved',
      toStatus: 'published',
      actor: null,
      message: buildVideoActivityMessage({ action: 'publish', toStatus: 'published' }),
      metadata: {},
      createdAt: workflow.publishedAt.toISOString(),
    });
  }

  const updatedAt = parseDate(video.updatedAt);
  if (timeline.length === 0 && updatedAt) {
    pushIfValid({
      id: `derived-update-${updatedAt.toISOString()}`,
      contentType: 'video',
      contentId: videoId,
      parentId: '',
      action: 'saved',
      fromStatus: null,
      toStatus: workflow.status,
      actor: null,
      message: 'Video updated.',
      metadata: {},
      createdAt: updatedAt.toISOString(),
    });
  }

  return timeline
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, Math.max(limit, 1));
}

export async function listVideoActivity(input: {
  videoId: string;
  video?: VideoActivitySource | null;
  limit?: number;
}) {
  const recorded = await listContentActivity({
    contentType: 'video',
    contentId: input.videoId,
    limit: input.limit,
  });

  if (recorded.length > 0) {
    return recorded;
  }

  return deriveVideoActivity(input.video, input.limit);
}
