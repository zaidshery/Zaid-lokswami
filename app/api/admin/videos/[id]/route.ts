import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import Video from '@/lib/models/Video';
import User from '@/lib/models/User';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import {
  canDeleteContent,
  canEditContent,
  canReadContent,
  canTransitionContent,
  type ContentTransitionAction,
} from '@/lib/auth/permissions';
import {
  buildVideoActivityMessage,
  recordVideoActivity,
} from '@/lib/server/videoActivity';
import type { CreateVideoInput } from '@/lib/storage/videosFile';
import {
  deleteStoredVideo,
  getStoredVideoById,
  updateStoredVideo,
} from '@/lib/storage/videosFile';
import {
  applyVideoWorkflowAction,
  resolveVideoWorkflow,
} from '@/lib/workflow/video';
import { isWorkflowPriority } from '@/lib/workflow/types';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type LeanVideoRecord = Record<string, unknown> & {
  isPublished?: boolean;
  workflow?: Record<string, unknown> | null;
  publishedAt?: string | Date;
  updatedAt?: string | Date;
};

type WorkflowActionBody = {
  action?: ContentTransitionAction;
  assignedToId?: string;
  scheduledFor?: string;
  dueAt?: string;
  priority?: string;
  rejectionReason?: string;
  comment?: string;
};

const WORKFLOW_ACTIONS = new Set<ContentTransitionAction>([
  'submit',
  'assign',
  'start_review',
  'move_to_copy_edit',
  'request_changes',
  'mark_ready_for_approval',
  'approve',
  'reject',
  'schedule',
  'publish',
  'archive',
]);

function getYouTubeId(value: string) {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.replace('www.', '').toLowerCase();

    if (host === 'youtu.be') return url.pathname.slice(1) || null;
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') return url.searchParams.get('v');
      if (url.pathname.startsWith('/shorts/')) return url.pathname.split('/')[2] || null;
      if (url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2] || null;
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeVideoUpdate(body: unknown) {
  const source = typeof body === 'object' && body ? (body as Record<string, unknown>) : {};
  const updates: Record<string, unknown> = {};

  if (typeof source.title === 'string') updates.title = source.title.trim();
  if (typeof source.description === 'string') updates.description = source.description.trim();
  if (typeof source.thumbnail === 'string') updates.thumbnail = source.thumbnail.trim();
  if (typeof source.videoUrl === 'string') {
    const videoUrl = source.videoUrl.trim();
    if (!videoUrl || !getYouTubeId(videoUrl)) {
      return { updates: null, error: 'Video URL must be a valid YouTube URL' };
    }
    updates.videoUrl = videoUrl;
  }

  if (typeof source.category === 'string') {
    updates.category = source.category.trim();
  }

  if (source.duration !== undefined) {
    const duration = Number.parseInt(String(source.duration), 10);
    if (!Number.isFinite(duration) || duration < 1) {
      return { updates: null, error: 'Invalid duration' };
    }
    updates.duration = duration;
  }

  if (typeof source.isShort === 'boolean') {
    updates.isShort = source.isShort;
  }

  if (typeof source.isPublished === 'boolean') {
    updates.isPublished = source.isPublished;
  }

  if (source.shortsRank !== undefined) {
    const shortsRank = Number.parseInt(String(source.shortsRank), 10);
    if (!Number.isFinite(shortsRank)) {
      return { updates: null, error: 'Invalid shorts rank' };
    }
    updates.shortsRank = shortsRank;
  }

  if (source.views !== undefined) {
    const views = Number.parseInt(String(source.views), 10);
    if (!Number.isFinite(views) || views < 0) {
      return { updates: null, error: 'Invalid views count' };
    }
    updates.views = views;
  }

  if (source.publishedAt !== undefined) {
    const publishedAt = new Date(String(source.publishedAt));
    if (Number.isNaN(publishedAt.getTime())) {
      return { updates: null, error: 'Invalid published date' };
    }
    updates.publishedAt = publishedAt;
  }

  return { updates, error: null };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '';
}

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI) return true;

  try {
    await connectDB();
    return false;
  } catch (error) {
    console.error('MongoDB unavailable for video id route, using file store.', error);
    return true;
  }
}

function applyAutoThumbnail(updates: Record<string, unknown>) {
  if (
    typeof updates.videoUrl === 'string' &&
    (updates.thumbnail === undefined || String(updates.thumbnail).trim() === '')
  ) {
    const youtubeId = getYouTubeId(updates.videoUrl);
    if (youtubeId) {
      updates.thumbnail = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
    }
  }
}

function buildVideoPermissionRecord(video: {
  isPublished?: unknown;
  workflow?: unknown;
  publishedAt?: unknown;
  updatedAt?: unknown;
}) {
  return {
    workflow: resolveVideoWorkflow({
      workflow:
        typeof video.workflow === 'object' && video.workflow
          ? (video.workflow as Record<string, unknown>)
          : null,
      isPublished: video.isPublished,
      publishedAt: video.publishedAt,
      updatedAt: video.updatedAt,
    }),
  };
}

function resolveVideoResponse(video: {
  isPublished?: boolean;
  workflow?: unknown;
  publishedAt?: unknown;
  updatedAt?: unknown;
}) {
  const workflow = resolveVideoWorkflow({
    workflow:
      typeof video.workflow === 'object' && video.workflow
        ? (video.workflow as Record<string, unknown>)
        : null,
    isPublished: video.isPublished,
    publishedAt: video.publishedAt,
    updatedAt: video.updatedAt,
  });

  return {
    ...video,
    isPublished: workflow.status === 'published',
    workflow,
  };
}

function isWorkflowAction(value: unknown): value is ContentTransitionAction {
  return typeof value === 'string' && WORKFLOW_ACTIONS.has(value as ContentTransitionAction);
}

function parseOptionalDate(value: unknown) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toStoredWorkflowUpdate(workflow: ReturnType<typeof resolveVideoWorkflow>) {
  return {
    ...workflow,
    submittedAt: workflow.submittedAt?.toISOString() || null,
    approvedAt: workflow.approvedAt?.toISOString() || null,
    rejectedAt: workflow.rejectedAt?.toISOString() || null,
    publishedAt: workflow.publishedAt?.toISOString() || null,
    scheduledFor: workflow.scheduledFor?.toISOString() || null,
    dueAt: workflow.dueAt?.toISOString() || null,
    comments: workflow.comments.map((comment) => ({
      ...comment,
      createdAt: comment.createdAt.toISOString(),
    })),
  };
}

function compactMetadata(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === null || entry === undefined) return false;
      if (typeof entry === 'string') return entry.trim().length > 0;
      if (Array.isArray(entry)) return entry.length > 0;
      return true;
    })
  );
}

async function resolveAssignee(assignedToId: string) {
  const normalized = assignedToId.trim();
  if (!normalized) return null;

  const query = Types.ObjectId.isValid(normalized)
    ? { _id: normalized }
    : { email: normalized.toLowerCase() };
  const assignee = await User.findOne(query).select('_id name email role').lean();
  if (!assignee || typeof assignee.role !== 'string' || assignee.role === 'reader') {
    return null;
  }

  return {
    id: String(assignee._id || ''),
    name: String(assignee.name || '').trim() || String(assignee.email || '').trim(),
    email: String(assignee.email || '').trim(),
    role: assignee.role,
  };
}

function applyLegacyPublishCompatibility(
  currentWorkflow: ReturnType<typeof resolveVideoWorkflow>,
  explicitPublishedState: boolean | undefined
) {
  if (typeof explicitPublishedState !== 'boolean') {
    return currentWorkflow;
  }

  if (explicitPublishedState) {
    return {
      ...currentWorkflow,
      status: 'published' as const,
      publishedAt: new Date(),
      scheduledFor: null,
      rejectionReason: '',
    };
  }

  if (currentWorkflow.status === 'published') {
    return {
      ...currentWorkflow,
      status: 'draft' as const,
      publishedAt: null,
    };
  }

  return currentWorkflow;
}

export async function GET(
  _req: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const user = await getAdminSessionFromReq(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (await shouldUseFileStore()) {
      const video = await getStoredVideoById(id);
      if (!video) {
        return NextResponse.json(
          { success: false, error: 'Video not found' },
          { status: 404 }
        );
      }
      if (!canReadContent(user, buildVideoPermissionRecord(video), { allowViewerRead: true })) {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
      }

      return NextResponse.json({ success: true, data: resolveVideoResponse(video) });
    }

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid video ID' },
        { status: 400 }
      );
    }

    const video = (await Video.findById(id).lean()) as LeanVideoRecord | null;
    if (!video) {
      return NextResponse.json(
        { success: false, error: 'Video not found' },
        { status: 404 }
      );
    }

    if (!canReadContent(user, buildVideoPermissionRecord(video), { allowViewerRead: true })) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: resolveVideoResponse(video) });
  } catch (error) {
    console.error('Error fetching video:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch video' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const user = await getAdminSessionFromReq(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    if (!isWorkflowAction((body as WorkflowActionBody).action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid workflow action' },
        { status: 400 }
      );
    }

    const actionBody = body as WorkflowActionBody;
    const action = actionBody.action;

    if (await shouldUseFileStore()) {
      const currentVideo = await getStoredVideoById(id);
      if (!currentVideo) {
        return NextResponse.json(
          { success: false, error: 'Video not found' },
          { status: 404 }
        );
      }

      const permissionRecord = buildVideoPermissionRecord(currentVideo);
      if (!action || !canTransitionContent(user, permissionRecord, action)) {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
      }

      let assignedTo = null;
      if (action === 'assign') {
        if (!process.env.MONGODB_URI?.trim()) {
          return NextResponse.json(
            { success: false, error: 'Assignments require MongoDB-backed users.' },
            { status: 503 }
          );
        }

        await connectDB();
        assignedTo = await resolveAssignee(String(actionBody.assignedToId || ''));
        if (!assignedTo) {
          return NextResponse.json(
            { success: false, error: 'Valid assignedToId is required' },
            { status: 400 }
          );
        }
      }

      try {
        const { fromStatus, toStatus, nextWorkflow } = applyVideoWorkflowAction({
          action,
          actor: user,
          currentWorkflow: resolveVideoWorkflow(currentVideo),
          assignedTo,
          scheduledFor: parseOptionalDate(actionBody.scheduledFor),
          dueAt: parseOptionalDate(actionBody.dueAt),
          priority: isWorkflowPriority(actionBody.priority) ? actionBody.priority : undefined,
          comment: actionBody.comment,
          rejectionReason: actionBody.rejectionReason,
        });

        const video = await updateStoredVideo(
          id,
          {
            isPublished: toStatus === 'published',
            workflow: toStoredWorkflowUpdate(nextWorkflow),
            ...(toStatus === 'published'
              ? { publishedAt: new Date().toISOString() }
              : {}),
          }
        );

        if (!video) {
          return NextResponse.json(
            { success: false, error: 'Video not found' },
            { status: 404 }
          );
        }

        await recordVideoActivity({
          videoId: id,
          actor: user,
          action,
          fromStatus,
          toStatus,
          message: buildVideoActivityMessage({
            action,
            toStatus,
            assignedTo: nextWorkflow.assignedTo,
            rejectionReason: nextWorkflow.rejectionReason,
          }),
          metadata: compactMetadata({
            assignedToId: nextWorkflow.assignedTo?.id || '',
            assignedToName: nextWorkflow.assignedTo?.name || '',
            priority: nextWorkflow.priority,
            dueAt: nextWorkflow.dueAt?.toISOString() || '',
            scheduledFor: nextWorkflow.scheduledFor?.toISOString() || '',
            rejectionReason: nextWorkflow.rejectionReason || '',
            comment: actionBody.comment?.trim() || '',
          }),
        });

        return NextResponse.json({
          success: true,
          data: resolveVideoResponse(video),
          message: `Video moved to ${toStatus}.`,
        });
      } catch (workflowError) {
        return NextResponse.json(
          {
            success: false,
            error:
              workflowError instanceof Error
                ? workflowError.message
                : 'Failed to update video workflow',
          },
          { status: 400 }
        );
      }
    }

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid video ID' },
        { status: 400 }
      );
    }

    const current = (await Video.findById(id).lean()) as LeanVideoRecord | null;
    if (!current) {
      return NextResponse.json(
        { success: false, error: 'Video not found' },
        { status: 404 }
      );
    }

    const permissionRecord = buildVideoPermissionRecord(current);
    if (!action || !canTransitionContent(user, permissionRecord, action)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    let assignedTo = null;
    if (action === 'assign') {
      assignedTo = await resolveAssignee(String(actionBody.assignedToId || ''));
      if (!assignedTo) {
        return NextResponse.json(
          { success: false, error: 'Valid assignedToId is required' },
          { status: 400 }
        );
      }
    }

    try {
      const { fromStatus, toStatus, nextWorkflow } = applyVideoWorkflowAction({
        action,
        actor: user,
        currentWorkflow: resolveVideoWorkflow(current),
        assignedTo,
        scheduledFor: parseOptionalDate(actionBody.scheduledFor),
        dueAt: parseOptionalDate(actionBody.dueAt),
        priority: isWorkflowPriority(actionBody.priority) ? actionBody.priority : undefined,
        comment: actionBody.comment,
        rejectionReason: actionBody.rejectionReason,
      });

      const video = await Video.findByIdAndUpdate(
        id,
        {
          $set: {
            workflow: nextWorkflow,
            isPublished: toStatus === 'published',
            updatedAt: new Date(),
            ...(toStatus === 'published' ? { publishedAt: new Date() } : {}),
          },
        },
        { new: true, runValidators: true }
      );

      if (!video) {
        return NextResponse.json(
          { success: false, error: 'Video not found' },
          { status: 404 }
        );
      }

      await recordVideoActivity({
        videoId: id,
        actor: user,
        action,
        fromStatus,
        toStatus,
        message: buildVideoActivityMessage({
          action,
          toStatus,
          assignedTo: nextWorkflow.assignedTo,
          rejectionReason: nextWorkflow.rejectionReason,
        }),
        metadata: compactMetadata({
          assignedToId: nextWorkflow.assignedTo?.id || '',
          assignedToName: nextWorkflow.assignedTo?.name || '',
          priority: nextWorkflow.priority,
          dueAt: nextWorkflow.dueAt?.toISOString() || '',
          scheduledFor: nextWorkflow.scheduledFor?.toISOString() || '',
          rejectionReason: nextWorkflow.rejectionReason || '',
          comment: actionBody.comment?.trim() || '',
        }),
      });

      return NextResponse.json({
        success: true,
        data: resolveVideoResponse(video.toObject()),
        message: `Video moved to ${toStatus}.`,
      });
    } catch (workflowError) {
      return NextResponse.json(
        {
          success: false,
          error:
            workflowError instanceof Error
              ? workflowError.message
              : 'Failed to update video workflow',
        },
        { status: 400 }
      );
    }
  } catch (error: unknown) {
    console.error('Error updating video workflow:', error);
    const message =
      process.env.NODE_ENV !== 'production'
        ? getErrorMessage(error) || 'Failed to update video workflow'
        : 'Failed to update video workflow';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const user = await getAdminSessionFromReq(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { updates, error } = normalizeVideoUpdate(body);

    if (error) {
      return NextResponse.json(
        { success: false, error },
        { status: 400 }
      );
    }

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    applyAutoThumbnail(updates);

    if (await shouldUseFileStore()) {
      const currentVideo = await getStoredVideoById(id);
      if (!currentVideo) {
        return NextResponse.json(
          { success: false, error: 'Video not found' },
          { status: 404 }
        );
      }
      if (!canEditContent(user, buildVideoPermissionRecord(currentVideo))) {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
      }

      const publishedState =
        typeof updates.isPublished === 'boolean' ? Boolean(updates.isPublished) : undefined;
      const nextWorkflow = applyLegacyPublishCompatibility(
        resolveVideoWorkflow(currentVideo),
        publishedState
      );

      const normalizedForFileStore = {
        ...(updates as Partial<CreateVideoInput> & { publishedAt?: string; updatedAt?: string }),
        workflow: toStoredWorkflowUpdate(nextWorkflow),
        isPublished: nextWorkflow.status === 'published',
        ...(updates.publishedAt instanceof Date
          ? { publishedAt: updates.publishedAt.toISOString() }
          : {}),
      };

      const video = await updateStoredVideo(id, normalizedForFileStore);

      if (!video) {
        return NextResponse.json(
          { success: false, error: 'Video not found' },
          { status: 404 }
        );
      }

      await recordVideoActivity({
        videoId: id,
        actor: user,
        action: 'saved',
        toStatus: resolveVideoWorkflow(video).status,
        message: buildVideoActivityMessage({ action: 'saved' }),
        metadata: {
          changedFields: Object.keys(updates),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Video updated successfully',
        data: resolveVideoResponse(video),
      });
    }

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid video ID' },
        { status: 400 }
      );
    }

    const current = (await Video.findById(id).lean()) as LeanVideoRecord | null;
    if (!current) {
      return NextResponse.json(
        { success: false, error: 'Video not found' },
        { status: 404 }
      );
    }
    if (!canEditContent(user, buildVideoPermissionRecord(current))) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const publishedState =
      typeof updates.isPublished === 'boolean' ? Boolean(updates.isPublished) : undefined;
    const nextWorkflow = applyLegacyPublishCompatibility(
      resolveVideoWorkflow(current),
      publishedState
    );

    const video = await Video.findByIdAndUpdate(
      id,
      {
        ...updates,
        isPublished: nextWorkflow.status === 'published',
        workflow: nextWorkflow,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    );

    if (!video) {
      return NextResponse.json(
        { success: false, error: 'Video not found' },
        { status: 404 }
      );
    }

    await recordVideoActivity({
      videoId: id,
      actor: user,
      action: 'saved',
      toStatus: resolveVideoWorkflow(video.toObject()).status,
      message: buildVideoActivityMessage({ action: 'saved' }),
      metadata: {
        changedFields: Object.keys(updates),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Video updated successfully',
      data: resolveVideoResponse(video.toObject()),
    });
  } catch (error: unknown) {
    console.error('Error updating video:', error);
    const message =
      process.env.NODE_ENV !== 'production'
        ? getErrorMessage(error) || 'Failed to update video'
        : 'Failed to update video';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const user = await getAdminSessionFromReq(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (!canDeleteContent(user)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (await shouldUseFileStore()) {
      const deleted = await deleteStoredVideo(id);
      if (!deleted) {
        return NextResponse.json(
          { success: false, error: 'Video not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Video deleted successfully',
      });
    }

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid video ID' },
        { status: 400 }
      );
    }

    const video = await Video.findByIdAndDelete(id);

    if (!video) {
      return NextResponse.json(
        { success: false, error: 'Video not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Video deleted successfully',
    });
  } catch (error: unknown) {
    console.error('Error deleting video:', error);
    const message =
      process.env.NODE_ENV !== 'production'
        ? getErrorMessage(error) || 'Failed to delete video'
        : 'Failed to delete video';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
