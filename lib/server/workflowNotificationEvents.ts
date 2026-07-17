import 'server-only';

import connectDB from '@/lib/db/mongoose';
import User from '@/lib/models/User';
import type { AdminSessionIdentity } from '@/lib/auth/admin';
import type { WorkflowContentType, WorkflowMeta } from '@/lib/workflow/types';
import { createWorkflowNotification, type WorkflowNotificationEvent } from '@/lib/storage/workflowNotifications';

type Recipient = { id: string; email: string };

const EVENT_COPY: Partial<Record<string, { event: WorkflowNotificationEvent; en: string; hi: string }>> = {
  assign: { event: 'assigned', en: 'This item was assigned to you.', hi: '\u092f\u0939 \u0906\u0907\u091f\u092e \u0906\u092a\u0915\u094b \u0905\u0938\u093e\u0907\u0928 \u0915\u093f\u092f\u093e \u0917\u092f\u093e \u0939\u0948\u0964' },
  request_changes: { event: 'changes_requested', en: 'The desk requested changes before this item can continue.', hi: '\u0921\u0947\u0938\u094d\u0915 \u0928\u0947 \u0906\u0917\u0947 \u092c\u0922\u093c\u0928\u0947 \u0938\u0947 \u092a\u0939\u0932\u0947 \u092c\u0926\u0932\u093e\u0935 \u092e\u093e\u0902\u0917\u0947 \u0939\u0948\u0902\u0964' },
  mark_ready_for_approval: { event: 'ready_for_approval', en: 'This item is ready for admin approval.', hi: '\u092f\u0939 \u0906\u0907\u091f\u092e \u090f\u0921\u092e\u093f\u0928 \u0905\u092a\u094d\u0930\u0942\u0935\u0932 \u0915\u0947 \u0932\u093f\u090f \u0924\u0948\u092f\u093e\u0930 \u0939\u0948\u0964' },
  approve: { event: 'approved', en: 'This item was approved and can move to release.', hi: '\u092f\u0939 \u0906\u0907\u091f\u092e \u0905\u092a\u094d\u0930\u0942\u0935 \u0939\u094b \u0917\u092f\u093e \u0939\u0948 \u0914\u0930 \u0930\u093f\u0932\u0940\u091c\u093c \u0915\u0947 \u0932\u093f\u090f \u0924\u0948\u092f\u093e\u0930 \u0939\u0948\u0964' },
  publish: { event: 'published', en: 'This item was published.', hi: '\u092f\u0939 \u0906\u0907\u091f\u092e \u092a\u094d\u0930\u0915\u093e\u0936\u093f\u0924 \u0939\u094b \u0917\u092f\u093e \u0939\u0948\u0964' },
  fast_publish: { event: 'fast_published', en: 'This item was urgently published with an audited exception.', hi: '\u092f\u0939 \u0906\u0907\u091f\u092e \u0911\u0921\u093f\u091f \u0915\u093f\u090f \u0917\u090f \u0905\u092a\u0935\u093e\u0926 \u0915\u0947 \u0938\u093e\u0925 \u0924\u0924\u094d\u0915\u093e\u0932 \u092a\u094d\u0930\u0915\u093e\u0936\u093f\u0924 \u0939\u0941\u0906\u0964' },
};

async function adminRecipients(): Promise<Recipient[]> {
  if (!process.env.MONGODB_URI?.trim()) return [];
  try {
    await connectDB();
    const users = await User.find({ role: { $in: ['admin', 'super_admin'] }, isActive: { $ne: false } })
      .select('_id email')
      .lean();
    return users.map((user) => ({ id: String(user._id || ''), email: String(user.email || '').trim().toLowerCase() })).filter((user) => user.email);
  } catch {
    return [];
  }
}

function actorRecipient(actor: WorkflowMeta['createdBy']): Recipient | null {
  if (!actor?.email) return null;
  return { id: actor.id, email: actor.email.trim().toLowerCase() };
}

export async function notifyWorkflowEvent(input: {
  contentType: Exclude<WorkflowContentType, 'epaperArticle'>;
  contentId: string;
  title: string;
  href: string;
  action: string;
  workflow: WorkflowMeta;
  actor: Pick<AdminSessionIdentity, 'email'>;
}) {
  const copy = EVENT_COPY[input.action];
  if (!copy) return [];

  let recipients: Recipient[] = [];
  if (input.action === 'assign') {
    const assignee = actorRecipient(input.workflow.assignedTo);
    if (assignee) recipients = [assignee];
  } else if (input.action === 'request_changes') {
    const creator = actorRecipient(input.workflow.createdBy);
    if (creator) recipients = [creator];
  } else if (input.action === 'mark_ready_for_approval') {
    recipients = await adminRecipients();
  } else {
    recipients = [actorRecipient(input.workflow.createdBy), actorRecipient(input.workflow.assignedTo)].filter((recipient): recipient is Recipient => Boolean(recipient));
  }

  const actorEmail = input.actor.email.trim().toLowerCase();
  const unique = Array.from(new Map(recipients.filter((recipient) => recipient.email && recipient.email !== actorEmail).map((recipient) => [recipient.email, recipient])).values());
  const eventMarker = input.workflow.comments.at(-1)?.id || input.workflow.publishedAt?.toISOString() || input.workflow.approvedAt?.toISOString() || input.workflow.dueAt?.toISOString() || new Date().toISOString();
  return Promise.all(unique.map((recipient) => createWorkflowNotification({
    recipientId: recipient.id,
    recipientEmail: recipient.email,
    eventType: copy.event,
    contentType: input.contentType,
    contentId: input.contentId,
    publicationType: null,
    title: input.title,
    message: copy.en,
    messageHi: copy.hi,
    href: input.href,
    dedupeKey: `${input.contentType}:${input.contentId}:${input.action}:${recipient.email}:${eventMarker}`,
  })));
}
