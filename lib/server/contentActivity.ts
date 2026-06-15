import 'server-only';

import type { AdminSessionIdentity } from '@/lib/auth/admin';
import type { AdminRole } from '@/lib/auth/roles';
import connectDB from '@/lib/db/mongoose';
import ContentActivity from '@/lib/models/ContentActivity';
import type {
  ContentActivityStatus,
  WorkflowContentType,
} from '@/lib/workflow/types';

export type ContentActivityActor = {
  id: string;
  name: string;
  email: string;
  role: AdminRole | null;
};

export type ContentActivityItem = {
  id: string;
  contentType: WorkflowContentType;
  contentId: string;
  parentId: string;
  action: string;
  fromStatus: ContentActivityStatus | null;
  toStatus: ContentActivityStatus | null;
  actor: ContentActivityActor | null;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  source: 'audit' | 'derived';
};

type RecordContentActivityInput = {
  contentType: WorkflowContentType;
  contentId: string;
  parentId?: string;
  action: string;
  fromStatus?: ContentActivityStatus | null;
  toStatus?: ContentActivityStatus | null;
  actor?: Pick<AdminSessionIdentity, 'id' | 'name' | 'email' | 'role'> | null;
  message?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
};

type ListContentActivityInput = {
  contentType: WorkflowContentType;
  contentId: string;
  limit?: number;
};

type ListGlobalContentActivityInput = {
  contentType?: WorkflowContentType;
  actorEmail?: string | null;
  limit?: number;
};

function buildMetadata(input: Record<string, unknown> | undefined) {
  return input && typeof input === 'object' ? input : {};
}

function parseDate(value: unknown) {
  if (!value) return null;

  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toActor(value: {
  actorId?: unknown;
  actorName?: unknown;
  actorEmail?: unknown;
  actorRole?: unknown;
}): ContentActivityActor | null {
  const id = typeof value.actorId === 'string' ? value.actorId.trim() : '';
  const name = typeof value.actorName === 'string' ? value.actorName.trim() : '';
  const email = typeof value.actorEmail === 'string' ? value.actorEmail.trim() : '';
  const role = typeof value.actorRole === 'string' ? (value.actorRole as AdminRole) : null;

  if (!id && !name && !email) {
    return null;
  }

  return { id, name, email, role };
}

function serializeContentActivity(activity: {
  _id?: unknown;
  contentType?: unknown;
  contentId?: unknown;
  parentId?: unknown;
  action?: unknown;
  fromStatus?: unknown;
  toStatus?: unknown;
  actorId?: unknown;
  actorName?: unknown;
  actorEmail?: unknown;
  actorRole?: unknown;
  message?: unknown;
  metadata?: unknown;
  createdAt?: unknown;
}): ContentActivityItem {
  const createdAt = parseDate(activity.createdAt)?.toISOString() || new Date(0).toISOString();

  return {
    id: String(activity._id || '').trim() || `${String(activity.action || 'activity')}-${createdAt}`,
    contentType: String(activity.contentType || 'article') as WorkflowContentType,
    contentId: String(activity.contentId || '').trim(),
    parentId: String(activity.parentId || '').trim(),
    action: String(activity.action || '').trim(),
    fromStatus:
      typeof activity.fromStatus === 'string'
        ? (activity.fromStatus as ContentActivityStatus)
        : null,
    toStatus:
      typeof activity.toStatus === 'string'
        ? (activity.toStatus as ContentActivityStatus)
        : null,
    actor: toActor({
      actorId: activity.actorId,
      actorName: activity.actorName,
      actorEmail: activity.actorEmail,
      actorRole: activity.actorRole,
    }),
    message: String(activity.message || '').trim(),
    metadata: buildMetadata(
      activity.metadata && typeof activity.metadata === 'object'
        ? (activity.metadata as Record<string, unknown>)
        : undefined
    ),
    createdAt,
    source: 'audit',
  };
}

async function canUseContentActivityStore() {
  if (!process.env.MONGODB_URI?.trim()) {
    return false;
  }

  try {
    await connectDB();
    return true;
  } catch (error) {
    console.error('MongoDB unavailable for content activity storage.', error);
    return false;
  }
}

export async function recordContentActivity(input: RecordContentActivityInput) {
  if (!(await canUseContentActivityStore())) {
    return;
  }

  try {
    await ContentActivity.create({
      contentType: input.contentType,
      contentId: String(input.contentId || '').trim(),
      parentId: String(input.parentId || '').trim(),
      action: String(input.action || '').trim(),
      fromStatus: input.fromStatus || undefined,
      toStatus: input.toStatus || undefined,
      actorId: String(input.actor?.id || '').trim(),
      actorName: String(input.actor?.name || '').trim(),
      actorEmail: String(input.actor?.email || '').trim().toLowerCase(),
      actorRole: String(input.actor?.role || '').trim(),
      message: String(input.message || '').trim(),
      metadata: buildMetadata(input.metadata),
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    });
  } catch (error) {
    console.error('Failed to write content activity.', error);
  }
}

export async function listContentActivity(input: ListContentActivityInput) {
  if (!(await canUseContentActivityStore())) {
    return [] as ContentActivityItem[];
  }

  try {
    const limit = Math.min(Math.max(input.limit || 40, 1), 100);
    const activities = await ContentActivity.find({
      contentType: input.contentType,
      contentId: String(input.contentId || '').trim(),
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean();

    return activities.map((activity) => serializeContentActivity(activity));
  } catch (error) {
    console.error('Failed to read content activity.', error);
    return [] as ContentActivityItem[];
  }
}

export async function listGlobalContentActivity(input: ListGlobalContentActivityInput = {}) {
  if (!(await canUseContentActivityStore())) {
    return [] as ContentActivityItem[];
  }

  try {
    const limit = Math.min(Math.max(input.limit || 60, 1), 200);
    const query: Record<string, unknown> = {};

    if (input.contentType) {
      query.contentType = input.contentType;
    }

    if (typeof input.actorEmail === 'string' && input.actorEmail.trim()) {
      query.actorEmail = input.actorEmail.trim().toLowerCase();
    }

    const activities = await ContentActivity.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean();

    return activities.map((activity) => serializeContentActivity(activity));
  } catch (error) {
    console.error('Failed to read global content activity.', error);
    return [] as ContentActivityItem[];
  }
}
