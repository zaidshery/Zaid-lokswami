import {
  CmsWorkflowStatusBadge,
  formatWorkflowStatusLabel,
} from '@/components/admin/CmsWorkflowStatusBadge';

export type CmsWorkflowActivityTimelineItem = {
  id?: string;
  action?: string;
  message?: string;
  createdAt?: string | null;
  source?: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actor?: {
    name?: string;
    email?: string;
    role?: string | null;
  } | null;
};

type CmsWorkflowActivityTimelineProps = {
  title?: string;
  description?: string;
  items: CmsWorkflowActivityTimelineItem[];
  isLoading?: boolean;
  onRefresh?: () => void | Promise<void>;
  emptyMessage: string;
  fallbackMessage: string;
  actionLabel?: (action: string | undefined) => string;
  formatTimestamp: (value: string) => string;
  formatStatusLabel?: (status: string) => string;
  formatActorRole?: (role: string) => string;
  className?: string;
  itemClassName?: string;
  listClassName?: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function formatWorkflowActivityActionLabel(action: string | undefined) {
  return String(action || 'activity')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function CmsWorkflowActivityTimeline({
  title = 'Activity Timeline',
  description = 'Saves and workflow changes land here so the desk can see what happened.',
  items,
  isLoading = false,
  onRefresh,
  emptyMessage,
  fallbackMessage,
  actionLabel = formatWorkflowActivityActionLabel,
  formatTimestamp,
  formatStatusLabel = formatWorkflowStatusLabel,
  formatActorRole,
  className,
  itemClassName,
  listClassName,
}: CmsWorkflowActivityTimelineProps) {
  return (
    <div className={cx('space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {description ? (
            <p className="mt-1 text-xs text-gray-500">{description}</p>
          ) : null}
        </div>
        {onRefresh ? (
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={isLoading}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        ) : null}
      </div>

      {isLoading ? <p className="text-sm text-gray-600">Loading activity...</p> : null}

      {!isLoading && items.length === 0 ? (
        <p className="text-sm text-gray-600">{emptyMessage}</p>
      ) : null}

      {!isLoading && items.length > 0 ? (
        <div className={cx('max-h-80 space-y-3 overflow-y-auto pr-1', listClassName)}>
          {items.map((activity, index) => (
            <div
              key={activity.id || `${activity.action || 'activity'}-${activity.createdAt || index}`}
              className={cx('rounded-lg border border-gray-200 bg-white p-3', itemClassName)}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-700">
                      {actionLabel(activity.action)}
                    </span>
                    {activity.toStatus ? (
                      <CmsWorkflowStatusBadge status={activity.toStatus} />
                    ) : null}
                    {activity.source === 'derived' ? (
                      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                        Derived
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-gray-800">
                    {activity.message || fallbackMessage}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="font-semibold text-gray-700">
                      {activity.actor?.name || activity.actor?.email || 'System'}
                    </span>
                    {activity.actor?.role ? (
                      <span>
                        {formatActorRole
                          ? formatActorRole(activity.actor.role)
                          : activity.actor.role}
                      </span>
                    ) : null}
                    {activity.fromStatus && activity.toStatus ? (
                      <span>
                        {formatStatusLabel(activity.fromStatus)} {'->'}{' '}
                        {formatStatusLabel(activity.toStatus)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  {activity.createdAt ? formatTimestamp(activity.createdAt) : 'Unknown time'}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
