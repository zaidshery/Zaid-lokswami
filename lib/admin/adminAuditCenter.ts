import 'server-only';

import { listLeadershipReportAlertNotificationHistory } from '@/lib/storage/leadershipReportAlertNotificationHistoryFile';
import { listLeadershipReportRunHistory } from '@/lib/storage/leadershipReportRunHistoryFile';
import {
  listGlobalContentActivity,
  type ContentActivityItem,
} from '@/lib/server/contentActivity';
import { getAuditLogs } from '@/lib/security/auditLogger';
import type { IAuditLog } from '@/lib/models/AuditLog';
import type { WorkflowContentType, WorkflowStatus } from '@/lib/workflow/types';

export type AdminAuditScope = 'all' | 'workflow' | 'reporting' | 'alerts' | 'security';
export type AdminAuditContentFilter = 'all' | WorkflowContentType;

export type AdminAuditEntry = {
  id: string;
  type: 'workflow' | 'report_run' | 'alert_notification';
  title: string;
  detail: string;
  statusLabel: string;
  tone: 'neutral' | 'good' | 'warning' | 'critical';
  actorLabel: string;
  actorMeta: string;
  createdAt: string;
  href: string;
  contentType: WorkflowContentType | null;
  contextLabel: string;
};

export type AdminAuditCenterData = {
  scope: AdminAuditScope;
  contentFilter: AdminAuditContentFilter;
  workflowAuditAvailable: boolean;
  summary: {
    securityEvents: number;
    adminMutations: number;
    authEvents: number;
    workflowEvents: number;
    publishingEvents: number;
    reportRuns: number;
    failedReportRuns: number;
    openAlertNotifications: number;
    resolvedAlertNotifications: number;
  };
  entries: AdminAuditEntry[];
};

function formatTitleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatContentTypeLabel(contentType: WorkflowContentType) {
  return contentType === 'epaper' ? 'E-Paper' : formatTitleCase(contentType);
}

function formatWorkflowStatusLabel(status: WorkflowStatus | null) {
  return status ? formatTitleCase(status) : 'Activity';
}

function formatWorkflowActionLabel(action: string) {
  return formatTitleCase(action || 'activity');
}

function formatDeliveryModeLabel(value: string) {
  switch (value) {
    case 'dashboard_link':
      return 'Dashboard Link';
    case 'markdown_export':
      return 'Markdown Export';
    case 'email_summary':
      return 'Email Summary';
    case 'webhook_summary':
      return 'Webhook Summary';
    default:
      return formatTitleCase(value);
  }
}

function formatWebhookProviderLabel(value: string | null | undefined) {
  switch (value) {
    case 'generic_json':
      return 'Generic JSON';
    case 'slack':
      return 'Slack';
    case 'discord':
      return 'Discord';
    case 'teams':
      return 'Microsoft Teams';
    case 'telegram':
      return 'Telegram';
    default:
      return '';
  }
}

function buildAuditHref(contentType: WorkflowContentType, contentId: string) {
  const encodedId = encodeURIComponent(contentId);
  switch (contentType) {
    case 'article':
      return `/admin/articles/${encodedId}/edit`;
    case 'story':
      return `/admin/stories/${encodedId}/edit`;
    case 'video':
      return `/admin/videos/${encodedId}/edit`;
    case 'epaper':
      return `/admin/epapers/${encodedId}`;
    default:
      return '/admin';
  }
}

function getWorkflowTone(activity: ContentActivityItem) {
  if (activity.toStatus === 'published') return 'good' as const;
  if (activity.action === 'reject') return 'critical' as const;
  if (
    activity.toStatus === 'ready_for_approval' ||
    activity.toStatus === 'approved' ||
    activity.toStatus === 'scheduled'
  ) {
    return 'good' as const;
  }
  if (
    activity.toStatus === 'submitted' ||
    activity.toStatus === 'assigned' ||
    activity.toStatus === 'in_review' ||
    activity.toStatus === 'copy_edit' ||
    activity.toStatus === 'changes_requested'
  ) {
    return 'warning' as const;
  }
  return 'neutral' as const;
}

function mapWorkflowEntry(activity: ContentActivityItem): AdminAuditEntry {
  const actorName =
    activity.actor?.name?.trim() ||
    activity.actor?.email?.trim() ||
    'System';
  const actorMeta =
    activity.actor?.role?.trim()
      ? formatTitleCase(activity.actor.role)
      : activity.fromStatus && activity.toStatus
        ? `${formatWorkflowStatusLabel(activity.fromStatus)} -> ${formatWorkflowStatusLabel(activity.toStatus)}`
        : formatContentTypeLabel(activity.contentType);

  return {
    id: `workflow-${activity.id}`,
    type: 'workflow',
    title: `${formatContentTypeLabel(activity.contentType)} ${formatWorkflowActionLabel(activity.action)}`,
    detail: activity.message || `${formatContentTypeLabel(activity.contentType)} activity recorded.`,
    statusLabel: formatWorkflowStatusLabel(activity.toStatus || activity.fromStatus),
    tone: getWorkflowTone(activity),
    actorLabel: actorName,
    actorMeta,
    createdAt: activity.createdAt,
    href: buildAuditHref(activity.contentType, activity.contentId),
    contentType: activity.contentType,
    contextLabel: `${formatContentTypeLabel(activity.contentType)} workflow`,
  };
}

function mapReportRunEntry(
  entry: Awaited<ReturnType<typeof listLeadershipReportRunHistory>>[number]
): AdminAuditEntry {
  const providerLabel = formatWebhookProviderLabel(entry.webhookProvider || null);
  const contextParts = [
    formatDeliveryModeLabel(entry.deliveryMode),
    formatTitleCase(entry.trigger),
    providerLabel,
  ].filter(Boolean);

  return {
    id: `report-run-${entry.id}`,
    type: 'report_run',
    title: `${entry.cadenceLabel} report run`,
    detail: entry.summary || `${entry.label} execution recorded.`,
    statusLabel: formatTitleCase(entry.status),
    tone:
      entry.status === 'success'
        ? 'good'
        : entry.status === 'failed'
          ? 'critical'
          : 'neutral',
    actorLabel: entry.actorEmail || (entry.trigger === 'cron' ? 'Cron Runner' : 'System'),
    actorMeta: contextParts.join(' / '),
    createdAt: entry.createdAt,
    href: '/admin/analytics',
    contentType: null,
    contextLabel: 'Leadership reporting',
  };
}

function mapAlertNotificationEntry(
  entry: Awaited<ReturnType<typeof listLeadershipReportAlertNotificationHistory>>[number]
): AdminAuditEntry {
  const statusLabel = entry.resolvedAt
    ? 'Resolved'
    : entry.acknowledgedAt
      ? 'Acknowledged'
      : entry.status === 'failed'
        ? 'Failed'
        : 'Open';

  return {
    id: `alert-notification-${entry.id}`,
    type: 'alert_notification',
    title: 'Critical delivery alert notification',
    detail:
      entry.reason ||
      `${entry.alertCount} reporting alert(s) triggered a leadership notification.`,
    statusLabel,
    tone:
      entry.resolvedAt
        ? 'good'
        : entry.status === 'failed'
          ? 'critical'
          : entry.acknowledgedAt
            ? 'warning'
            : 'critical',
    actorLabel:
      entry.resolvedByEmail ||
      entry.acknowledgedByEmail ||
      entry.emailRecipients[0] ||
      'System',
    actorMeta: `${entry.alertCount} alert(s) / ${entry.emailRecipients.length} email / ${entry.webhookTargets} webhook`,
    createdAt: entry.createdAt,
    href: '/admin/settings',
    contentType: null,
    contextLabel: 'Critical reporting alerts',
  };
}

function getSecurityTone(entry: IAuditLog): AdminAuditEntry['tone'] {
  if (entry.responseStatus === 'rejected' || entry.statusCode >= 400) return 'critical';
  if (entry.action === 'delete' || entry.action === 'reject') return 'warning';
  if (entry.action === 'login' || entry.action === 'publish' || entry.action === 'approve') {
    return 'good';
  }
  return 'neutral';
}

function buildSecurityAuditHref(entry: IAuditLog) {
  const id = String(entry.resourceId || '').trim();
  const encodedId = encodeURIComponent(id);

  if (!id) return '/admin/audit-log?scope=security';

  switch (entry.resourceType) {
    case 'article':
      return `/admin/articles/${encodedId}/edit`;
    case 'story':
      return `/admin/stories/${encodedId}/edit`;
    case 'video':
      return `/admin/videos/${encodedId}/edit`;
    case 'epaper':
      return `/admin/epapers/${encodedId}`;
    case 'user':
      return '/admin/team';
    case 'settings':
      return '/admin/settings';
    default:
      return '/admin/audit-log?scope=security';
  }
}

function mapSecurityAuditEntry(entry: IAuditLog): AdminAuditEntry {
  const resourceLabel = formatTitleCase(String(entry.resourceType || 'other'));
  const actionLabel = formatTitleCase(String(entry.action || 'activity'));
  const actorLabel = String(entry.userEmail || entry.userId || 'Unknown user');
  const endpoint = String(entry.endpoint || '').trim();

  return {
    id: `security-${String(entry._id || `${entry.action}-${entry.timestamp}`)}`,
    type: 'workflow',
    title: `${resourceLabel} ${actionLabel}`,
    detail:
      String(entry.errorMessage || '').trim() ||
      `${entry.method} ${endpoint || 'admin action'} recorded with status ${entry.statusCode}.`,
    statusLabel:
      entry.responseStatus === 'rejected'
        ? 'Rejected'
        : entry.statusCode >= 400
          ? 'Error'
          : 'Recorded',
    tone: getSecurityTone(entry),
    actorLabel,
    actorMeta: `${formatTitleCase(String(entry.userRole || 'unknown'))} / ${entry.ipAddress || 'unknown IP'}`,
    createdAt:
      entry.timestamp instanceof Date
        ? entry.timestamp.toISOString()
        : String(entry.timestamp || new Date(0).toISOString()),
    href: buildSecurityAuditHref(entry),
    contentType:
      entry.resourceType === 'article' ||
      entry.resourceType === 'story' ||
      entry.resourceType === 'video' ||
      entry.resourceType === 'epaper'
        ? entry.resourceType
        : null,
    contextLabel: 'Security audit',
  };
}

export async function getAdminAuditCenterData(args: {
  scope: AdminAuditScope;
  contentFilter: AdminAuditContentFilter;
  limit?: number;
}) {
  const limit = Math.min(Math.max(args.limit || 60, 1), 120);
  const workflowAuditAvailable = Boolean(process.env.MONGODB_URI?.trim());
  const contentType =
    args.contentFilter === 'all' ? undefined : args.contentFilter;

  const [workflowActivities, reportRuns, alertNotifications, securityAuditLogs] = await Promise.all([
    listGlobalContentActivity({ contentType, limit: 120 }),
    listLeadershipReportRunHistory(80),
    listLeadershipReportAlertNotificationHistory(80),
    getAuditLogs({ limit: 120 }),
  ]);

  const workflowEntries = workflowActivities.map(mapWorkflowEntry);
  const reportEntries = reportRuns.map(mapReportRunEntry);
  const alertEntries = alertNotifications.map(mapAlertNotificationEntry);
  const securityEntries = securityAuditLogs.map(mapSecurityAuditEntry);

  const entries = [
    ...(args.scope === 'all' || args.scope === 'workflow' ? workflowEntries : []),
    ...(args.scope === 'all' || args.scope === 'reporting' ? reportEntries : []),
    ...(args.scope === 'all' || args.scope === 'alerts' ? alertEntries : []),
    ...(args.scope === 'all' || args.scope === 'security' ? securityEntries : []),
  ]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    )
    .slice(0, limit);

  return {
    scope: args.scope,
    contentFilter: args.contentFilter,
    workflowAuditAvailable,
    summary: {
      securityEvents: securityEntries.length,
      adminMutations: securityAuditLogs.filter((item) =>
        ['create', 'update', 'delete', 'publish', 'archive', 'assign', 'approve', 'reject'].includes(
          item.action
        )
      ).length,
      authEvents: securityAuditLogs.filter((item) => item.resourceType === 'auth_session').length,
      workflowEvents: workflowEntries.length,
      publishingEvents: workflowActivities.filter((item) => item.action === 'publish').length,
      reportRuns: reportEntries.length,
      failedReportRuns: reportRuns.filter((item) => item.status === 'failed').length,
      openAlertNotifications: alertNotifications.filter((item) => !item.resolvedAt).length,
      resolvedAlertNotifications: alertNotifications.filter((item) => Boolean(item.resolvedAt))
        .length,
    },
    entries,
  } satisfies AdminAuditCenterData;
}
