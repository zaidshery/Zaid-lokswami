import 'server-only';

import EPaper from '@/lib/models/EPaper';
import {
  buildEpaperActivityMessage,
  recordEpaperActivity,
} from '@/lib/server/epaperActivity';
import { logEpaperMetric } from '@/lib/server/epaperObservability';
import type { AdminSessionIdentity } from '@/lib/auth/admin';

type Actor = Pick<AdminSessionIdentity, 'id' | 'name' | 'email' | 'role'>;

export function assertEpaperDraftEditable(epaper: {
  status?: unknown;
  productionStatus?: unknown;
}) {
  if (epaper.status === 'published' || epaper.productionStatus === 'published') {
    throw new Error(
      'Published editions are immutable. Create a draft revision before making changes.'
    );
  }
}

export async function invalidateEpaperQa(input: {
  epaperId: string;
  actor: Actor;
  reason: string;
  pageNumbers?: number[];
}) {
  const current = await EPaper.findById(input.epaperId)
    .select('_id status productionStatus qaCompletedAt')
    .lean();
  if (!current) return { changed: false, fromStatus: null, toStatus: null };

  assertEpaperDraftEditable(current);
  const fromStatus = String(current.productionStatus || 'draft_upload');
  const shouldReturnToQa = fromStatus === 'ready_to_publish';
  const shouldClearQa = shouldReturnToQa || Boolean(current.qaCompletedAt);

  if (!shouldReturnToQa && !shouldClearQa) {
    return { changed: false, fromStatus, toStatus: fromStatus };
  }

  const toStatus = shouldReturnToQa ? 'qa_review' : fromStatus;
  await EPaper.findByIdAndUpdate(input.epaperId, {
    ...(shouldReturnToQa ? { productionStatus: 'qa_review' } : {}),
    qaCompletedAt: null,
  });

  await recordEpaperActivity({
    epaperId: input.epaperId,
    actor: input.actor,
    action: 'qa_invalidated',
    fromStatus: fromStatus as never,
    toStatus: toStatus as never,
    message: 'Edition returned to QA review after content changed.',
    metadata: {
      reason: input.reason,
      pageNumbers: input.pageNumbers || [],
    },
  });
  logEpaperMetric('qa_returned_after_edit', {
    epaperId: input.epaperId,
    fromStatus,
    toStatus,
    pageNumbers: input.pageNumbers || [],
    reason: input.reason,
  });

  return { changed: true, fromStatus, toStatus };
}

export function requireRequestChangesReason(value: unknown) {
  const reason = typeof value === 'string' ? value.trim() : '';
  if (!reason) {
    throw new Error('A reason is required when requesting changes.');
  }
  return reason;
}

export function buildRequestChangesMessage() {
  return buildEpaperActivityMessage({
    action: 'request_changes',
    toStatus: 'hotspot_mapping',
  });
}
