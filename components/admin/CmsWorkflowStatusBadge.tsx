type CmsWorkflowStatusBadgeProps = {
  status: string | null | undefined;
  className?: string;
};

type CmsWorkflowPriorityBadgeProps = {
  priority: string | null | undefined;
  className?: string;
  showPrefix?: boolean;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function formatWorkflowStatusLabel(status: string | null | undefined) {
  const value = String(status || '').trim();
  if (!value) return 'Unknown';

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatWorkflowContentTypeLabel(contentType: string | null | undefined) {
  const value = String(contentType || '').trim();
  if (value === 'epaper') return 'E-Paper';
  if (value === 'epaperArticle') return 'E-Paper Article';
  return formatWorkflowStatusLabel(value);
}

export function formatWorkflowPriorityLabel(priority: string | null | undefined) {
  const value = String(priority || 'normal').trim();
  if (!value) return 'Normal';

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getWorkflowStatusToneClass(status: string | null | undefined) {
  switch (status) {
    case 'published':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
    case 'approved':
    case 'ready_for_approval':
    case 'scheduled':
    case 'ready_to_publish':
      return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300';
    case 'pages_ready':
    case 'ocr_review':
    case 'hotspot_mapping':
    case 'qa_review':
    case 'submitted':
    case 'assigned':
    case 'in_review':
    case 'copy_edit':
    case 'changes_requested':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
    case 'rejected':
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300';
    default:
      return 'border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-white/10 dark:bg-white/10 dark:text-zinc-300';
  }
}

export function getWorkflowPriorityToneClass(priority: string | null | undefined) {
  const value = String(priority || 'normal').trim().toLowerCase();

  switch (value) {
    case 'urgent':
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300';
    case 'high':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
    case 'low':
      return 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/10 dark:text-zinc-300';
    case 'normal':
    default:
      return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300';
  }
}

export function CmsWorkflowStatusBadge({
  status,
  className,
}: CmsWorkflowStatusBadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
        getWorkflowStatusToneClass(status),
        className
      )}
    >
      {formatWorkflowStatusLabel(status)}
    </span>
  );
}

export function CmsWorkflowPriorityBadge({
  priority,
  className,
  showPrefix = false,
}: CmsWorkflowPriorityBadgeProps) {
  const label = formatWorkflowPriorityLabel(priority);

  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold',
        getWorkflowPriorityToneClass(priority),
        className
      )}
    >
      {showPrefix ? `Priority ${label}` : label}
    </span>
  );
}
