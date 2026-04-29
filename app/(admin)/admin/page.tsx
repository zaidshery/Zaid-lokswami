import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileText,
  Inbox,
  MessageSquare,
  Newspaper,
  Settings,
  TrendingUp,
  UserCog,
  Video,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  getMyWorkOverview,
  getReviewQueueOverview,
  type WorkflowArticleCard,
} from '@/lib/admin/articleWorkflowOverview';
import { getAdminDashboardData } from '@/lib/admin/dashboard';
import { getSuperAdminDashboardData, type SuperAdminAlert } from '@/lib/admin/superAdminDashboard';
import {
  getNewsroomPipelineAnalytics,
  normalizeNewsroomPipelineFilters,
  type NewsroomPipelineAnalytics,
} from '@/lib/admin/newsroomPipeline';
import type { TeamHealthSummary } from '@/lib/admin/teamHealth';
import { getAdminSession } from '@/lib/auth/admin';
import { canViewPage } from '@/lib/auth/permissions';
import { formatUserRoleLabel, isReporterDeskRole } from '@/lib/auth/roles';
import { formatUiDate } from '@/lib/utils/dateFormat';
import formatNumber from '@/lib/utils/formatNumber';

type QuickAction = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: string;
};

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

type StatCardConfig = {
  label: string;
  value: number;
  note: string;
  icon: LucideIcon;
  tone: string;
};

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ');
}

const SECTION_LINK_CLASS =
  'admin-shell-toolbar-btn inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] sm:text-xs sm:tracking-[0.14em]';

const PANEL_CLASS =
  'admin-shell-surface-strong rounded-[20px] p-3 sm:rounded-[32px] sm:p-6';

const SOFT_CARD_CLASS =
  'admin-shell-surface-muted rounded-[18px] p-3 shadow-[0_18px_48px_-40px_rgba(15,23,42,0.12)] sm:rounded-[24px] sm:p-4 dark:shadow-[0_18px_48px_-40px_rgba(0,0,0,0.4)]';

const METRIC_CARD_CLASS =
  'admin-shell-surface rounded-[16px] p-3 shadow-sm sm:rounded-[22px] sm:p-4';

const COMPACT_METRIC_CARD_CLASS =
  'admin-shell-surface rounded-[18px] p-3 shadow-sm sm:rounded-[22px] sm:p-4';

const EMPTY_STATE_CLASS =
  'rounded-[24px] border border-dashed border-[color:var(--admin-shell-border-strong)] bg-[color:var(--admin-shell-surface-muted)] p-4 text-sm text-[color:var(--admin-shell-text-muted)]';

function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatContentTypeLabel(contentType: string) {
  return contentType === 'epaper' ? 'E-Paper' : formatStatusLabel(contentType);
}

function formatNewsroomRoleLabel(role: string) {
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'admin':
      return 'Admin Desk';
    case 'copy_editor':
      return 'Copy Editor Desk';
    case 'reporter':
      return 'Reporter Desk';
    default:
      return 'Admin';
  }
}

function getWorkflowToneClass(status: string) {
  switch (status) {
    case 'published':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'approved':
    case 'ready_for_approval':
    case 'scheduled':
    case 'ready_to_publish':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'pages_ready':
    case 'ocr_review':
    case 'hotspot_mapping':
    case 'qa_review':
    case 'submitted':
    case 'assigned':
    case 'in_review':
    case 'copy_edit':
    case 'changes_requested':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'rejected':
      return 'border-red-200 bg-red-50 text-red-700';
    default:
      return 'border-gray-200 bg-gray-100 text-gray-700';
  }
}

function WorkflowPill({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${getWorkflowToneClass(status)}`}
    >
      {formatStatusLabel(status)}
    </span>
  );
}

function QuickActionCard({
  action,
  compactOnMobile = false,
}: {
  action: QuickAction;
  compactOnMobile?: boolean;
}) {
  const Icon = action.icon;

  return (
    <Link
      href={action.href}
      className={cx(
        'admin-shell-surface rounded-[28px] p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--admin-shell-shadow-strong)] sm:rounded-3xl sm:p-5',
        compactOnMobile && 'min-h-[136px] sm:min-h-0'
      )}
    >
      <div className={cx('inline-flex rounded-2xl p-3', action.tone, compactOnMobile && 'p-2.5 sm:p-3')}>
        <Icon className={cx('h-5 w-5', compactOnMobile && 'h-4 w-4 sm:h-5 sm:w-5')} />
      </div>
      <h2 className={cx('mt-4 text-lg font-bold text-[color:var(--admin-shell-text)]', compactOnMobile && 'text-base sm:text-lg')}>
        {action.label}
      </h2>
      <p
        className={cx(
          'mt-2 text-sm leading-6 text-[color:var(--admin-shell-text-muted)]',
          compactOnMobile && 'hidden text-xs leading-5 sm:block sm:text-sm sm:leading-6'
        )}
      >
        {action.description}
      </p>
    </Link>
  );
}

function StatCard({
  stat,
  compactOnMobile = false,
}: {
  stat: StatCardConfig;
  compactOnMobile?: boolean;
}) {
  return (
    <div className={cx('admin-shell-surface rounded-[28px] p-5 shadow-sm sm:rounded-3xl sm:p-6', compactOnMobile && 'p-4 sm:p-6')}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={cx('text-sm font-medium text-[color:var(--admin-shell-text-muted)]', compactOnMobile && 'text-xs sm:text-sm')}>
            {stat.label}
          </p>
          <p className={cx('mt-3 text-3xl font-black text-[color:var(--admin-shell-text)]', compactOnMobile && 'mt-2 text-2xl sm:mt-3 sm:text-3xl')}>
            {formatNumber(stat.value)}
          </p>
        </div>
        <div className={cx('rounded-2xl p-3', stat.tone, compactOnMobile && 'p-2.5 sm:p-3')}>
          <stat.icon className={cx('h-5 w-5', compactOnMobile && 'h-4 w-4 sm:h-5 sm:w-5')} />
        </div>
      </div>
      <p
        className={cx(
          'mt-4 text-sm text-[color:var(--admin-shell-text-muted)]',
          compactOnMobile && 'hidden sm:block'
        )}
      >
        {stat.note}
      </p>
    </div>
  );
}

function resolveSingleSearchParam(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : Array.isArray(value) ? value[0] : undefined;
}

function LeadershipActionCard({ action }: { action: QuickAction }) {
  const Icon = action.icon;

  return (
    <Link
      href={action.href}
      className="group admin-shell-surface relative overflow-hidden rounded-[20px] p-3 transition-all hover:-translate-y-1 hover:border-red-400/30 hover:shadow-[0_34px_90px_-40px_rgba(220,38,38,0.18)] sm:rounded-[28px] sm:p-5 dark:hover:shadow-[0_34px_90px_-40px_rgba(220,38,38,0.28)]"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent dark:via-white/15" />
      <div className="flex items-start justify-between gap-4">
        <div className={cx('inline-flex rounded-2xl p-2.5 ring-1 ring-black/5 sm:p-3 dark:ring-white/10', action.tone)}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <ArrowUpRight className="h-4 w-4 text-zinc-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-red-500 dark:text-zinc-500" />
      </div>
      <div className="mt-3 sm:mt-5">
        <p className="text-sm font-bold leading-5 text-[color:var(--admin-shell-text)] sm:text-base">{action.label}</p>
        <p className="mt-2 hidden text-sm leading-6 text-[color:var(--admin-shell-text-muted)] sm:block">
          {action.description}
        </p>
      </div>
    </Link>
  );
}

function LeadershipStatCard({ stat }: { stat: StatCardConfig }) {
  return (
    <div className="group admin-shell-surface relative overflow-hidden rounded-[18px] p-3 transition-all hover:-translate-y-0.5 hover:shadow-[var(--admin-shell-shadow-strong)] sm:rounded-[28px] sm:p-5">
      <div className={cx('pointer-events-none absolute -right-5 -top-5 h-24 w-24 rounded-full opacity-20 blur-2xl', stat.tone)} />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent dark:via-white/20" />
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase leading-4 tracking-[0.1em] text-[color:var(--admin-shell-text-muted)] sm:text-[11px] sm:tracking-[0.18em]">
            {stat.label}
          </p>
          <p className="mt-2 text-2xl font-black tracking-tight text-[color:var(--admin-shell-text)] sm:mt-4 sm:text-4xl">
            {formatNumber(stat.value)}
          </p>
        </div>
        <div className={cx('rounded-2xl p-2 ring-1 ring-black/5 sm:p-3 dark:ring-white/10', stat.tone)}>
          <stat.icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>
      <p className="mt-4 hidden text-sm leading-6 text-[color:var(--admin-shell-text-muted)] sm:block">{stat.note}</p>
    </div>
  );
}

function LeadershipHeroSection({
  metrics,
  alerts,
  quickActions,
}: {
  metrics: {
    readyDecisions: number;
    blockedEditions: number;
    teamCoverage: number;
    reportingAlerts: number;
  };
  alerts: SuperAdminAlert[];
  quickActions: QuickAction[];
}) {
  const criticalAlerts = alerts.filter((alert) => alert.severity === 'critical').length;
  const statusChips = [
    { label: 'Critical Alerts', value: criticalAlerts },
    { label: 'Ready Decisions', value: metrics.readyDecisions },
    { label: 'Blocked Editions', value: metrics.blockedEditions },
    { label: 'Active Coverage', value: metrics.teamCoverage },
  ];

  const focusPoints = [
    criticalAlerts > 0
      ? `${formatNumber(criticalAlerts)} critical signal${criticalAlerts === 1 ? '' : 's'} need leadership attention.`
      : 'No critical leadership signal is active right now.',
    metrics.blockedEditions > 0
      ? `${formatNumber(metrics.blockedEditions)} editions are still blocked by QA or extraction issues.`
      : 'No edition blockers are currently stopping release.',
    metrics.reportingAlerts > 0
      ? `${formatNumber(metrics.reportingAlerts)} reporting automation alert${metrics.reportingAlerts === 1 ? '' : 's'} need follow-up.`
      : 'Reporting automation is currently stable.',
  ];

  return (
    <section className="relative overflow-hidden rounded-[24px] border border-[color:var(--admin-shell-border-strong)] bg-[linear-gradient(135deg,rgba(255,252,247,0.96),rgba(248,241,232,0.95)_48%,rgba(243,238,230,0.98)_100%)] p-4 shadow-[var(--admin-shell-shadow-strong)] sm:rounded-[36px] sm:p-8 dark:bg-[linear-gradient(135deg,rgba(18,18,22,0.98),rgba(32,22,18,0.96)_42%,rgba(15,19,33,0.98)_100%)] lg:p-10">
      <div className="pointer-events-none absolute -right-10 top-0 h-48 w-48 rounded-full bg-red-500/12 blur-3xl dark:bg-red-500/16" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 rounded-full bg-amber-400/12 blur-3xl dark:bg-amber-400/10" />

      <div className="relative grid gap-4 sm:gap-8 xl:grid-cols-[1.45fr,0.8fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-red-600 sm:px-4 sm:text-[11px] sm:tracking-[0.28em] dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
            Super Admin
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-[color:var(--admin-shell-text)] sm:mt-5 sm:text-5xl">
            Leadership Dashboard
          </h1>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-[color:var(--admin-shell-text-muted)] sm:mt-4 sm:text-[15px] sm:leading-7">
            Track release readiness, blocked operations, reporting health, team coverage, and
            growth across the newsroom.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-6 sm:flex sm:flex-wrap sm:gap-3">
            {statusChips.map((chip) => (
              <div
                key={chip.label}
                className="admin-shell-surface rounded-2xl px-3 py-2 shadow-sm sm:px-4 sm:py-3"
              >
                <p className="text-[10px] font-semibold uppercase leading-4 tracking-[0.08em] text-[color:var(--admin-shell-text-muted)] sm:text-[11px] sm:tracking-[0.16em]">
                  {chip.label}
                </p>
                <p className="mt-1 text-base font-black text-[color:var(--admin-shell-text)] sm:text-lg">
                  {formatNumber(chip.value)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="hidden gap-4 sm:grid">
          <div className="admin-shell-surface rounded-[28px] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-shell-text-muted)]">
              Priority Alerts
            </p>
            <div className="mt-4 space-y-3">
              {focusPoints.map((point) => (
                <div
                  key={point}
                  className="admin-shell-surface-muted rounded-2xl px-4 py-3 text-sm leading-6 text-[color:var(--admin-shell-text)]"
                >
                  {point}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((action) => (
          <LeadershipActionCard key={action.href} action={action} />
        ))}
      </div>
    </section>
  );
}

function WorkflowListSection({
  title,
  description,
  href,
  linkLabel,
  items,
  emptyMessage,
  className,
  compactOnMobile = false,
  desktopTable = false,
}: {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  items: WorkflowArticleCard[];
  emptyMessage: string;
  className?: string;
  compactOnMobile?: boolean;
  desktopTable?: boolean;
}) {
  const visibleItems = items.slice(0, 4);

  return (
    <section className={cx(PANEL_CLASS, className)}>
      <div
        className={cx(
          'flex items-center justify-between gap-4',
          compactOnMobile && 'flex-col items-start sm:flex-row sm:items-center'
        )}
      >
        <div>
          <h2 className={cx('text-xl font-bold text-zinc-900 dark:text-zinc-100', compactOnMobile && 'text-lg sm:text-xl')}>
            {title}
          </h2>
          <p className={cx('mt-1 text-sm text-zinc-600 dark:text-zinc-300', compactOnMobile && 'text-xs leading-5 sm:text-sm sm:leading-6')}>
            {description}
          </p>
        </div>
        <Link href={href} className={SECTION_LINK_CLASS}>
          {linkLabel}
        </Link>
      </div>

      {desktopTable && visibleItems.length ? (
        <div className="mt-5 hidden overflow-hidden rounded-[22px] border border-[color:var(--admin-shell-border)] lg:block">
          <div className="grid grid-cols-[minmax(0,1.4fr)_0.55fr_0.8fr_0.65fr_0.55fr] gap-4 border-b border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface-muted)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--admin-shell-text-muted)]">
            <span>Title</span>
            <span>Type</span>
            <span>Owner</span>
            <span>Updated</span>
            <span className="text-right">Status</span>
          </div>
          <div className="divide-y divide-[color:var(--admin-shell-border)]">
            {visibleItems.map((item) => (
              <Link
                key={`${item.contentType}-${item.id}-table`}
                href={item.editHref}
                className="grid grid-cols-[minmax(0,1.4fr)_0.55fr_0.8fr_0.65fr_0.55fr] items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-[color:var(--admin-shell-surface-muted)]"
              >
                <span className="truncate font-semibold text-[color:var(--admin-shell-text)]">{item.title}</span>
                <span className="text-xs text-[color:var(--admin-shell-text-muted)]">{formatContentTypeLabel(item.contentType)}</span>
                <span className="truncate text-xs text-[color:var(--admin-shell-text-muted)]">
                  {item.assignedToName || item.createdByName || item.author}
                </span>
                <span className="text-xs text-[color:var(--admin-shell-text-muted)]">
                  {formatUiDate(item.updatedAt, item.updatedAt)}
                </span>
                <span className="justify-self-end"><WorkflowPill status={item.status} /></span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className={cx('mt-6 space-y-3', desktopTable && visibleItems.length > 0 && 'lg:hidden')}>
        {visibleItems.length ? (
          visibleItems.map((item, index) => (
            <Link
              key={`${item.contentType}-${item.id}`}
              href={item.editHref}
              className={cx(
                compactOnMobile
                  ? 'admin-shell-surface-muted flex flex-col gap-2 rounded-[20px] p-3 shadow-[0_18px_48px_-40px_rgba(15,23,42,0.12)] transition-all hover:-translate-y-0.5 hover:bg-zinc-100 dark:hover:bg-white/8 sm:rounded-[24px] sm:p-4 dark:shadow-[0_18px_48px_-40px_rgba(0,0,0,0.4)]'
                  : cx(
                      SOFT_CARD_CLASS,
                      'flex flex-col gap-3 transition-all hover:-translate-y-0.5 hover:bg-zinc-100 dark:hover:bg-white/8'
                    ),
                compactOnMobile && index >= 3 && 'hidden sm:flex'
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className={cx('truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100', compactOnMobile && 'text-[13px] sm:text-sm')}>
                    {item.title}
                  </p>
                  <p className={cx('mt-1 text-xs text-zinc-500 dark:text-zinc-400', compactOnMobile && 'text-[11px]')}>
                    {item.category} / {item.author} / {formatContentTypeLabel(item.contentType)}
                  </p>
                </div>
                <WorkflowPill status={item.status} />
              </div>
              <div className={cx('flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400', compactOnMobile && 'gap-2 text-[11px] leading-4')}>
                <span>Updated {formatUiDate(item.updatedAt, item.updatedAt)}</span>
                {item.assignedToName ? (
                  <span className={cx(compactOnMobile && 'hidden sm:inline')}>
                    Assignee: {item.assignedToName}
                  </span>
                ) : null}
                {item.createdByName ? (
                  <span className={cx(compactOnMobile && 'hidden sm:inline')}>
                    Created by: {item.createdByName}
                  </span>
                ) : null}
              </div>
            </Link>
          ))
        ) : (
          <div className={EMPTY_STATE_CLASS}>
            {emptyMessage}
          </div>
        )}
      </div>
    </section>
  );
}

function InboxSnapshot({
  counts,
  className,
}: {
  counts: { all: number; new: number; inProgress: number; resolved: number };
  className?: string;
}) {
  const isEmpty = counts.all === 0 && counts.new === 0 && counts.inProgress === 0 && counts.resolved === 0;
  const stats = [
    { label: 'All Messages', value: counts.all },
    { label: 'New', value: counts.new },
    { label: 'In Progress', value: counts.inProgress },
    { label: 'Resolved', value: counts.resolved },
  ];

  return (
    <section className={cx(PANEL_CLASS, className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Inbox Snapshot</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Reader-message pressure visible to the desk at a glance.
          </p>
        </div>
        <Link href="/admin/contact-messages" className={SECTION_LINK_CLASS}>
          Open Inbox
        </Link>
      </div>

      {isEmpty ? (
        <div className="mt-5 rounded-[22px] border border-emerald-500/20 bg-emerald-500/10 px-4 py-5 text-emerald-700 dark:text-emerald-300">
          <p className="text-base font-bold">Inbox clear</p>
          <p className="mt-1 text-sm opacity-90">No reader messages need action.</p>
        </div>
      ) : (
      <div className="mt-6 grid grid-cols-2 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className={METRIC_CARD_CLASS}>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {stat.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {formatNumber(stat.value)}
            </p>
          </div>
        ))}
      </div>
      )}
    </section>
  );
}

function PipelineSummarySection({
  analytics,
}: {
  analytics: NewsroomPipelineAnalytics;
}) {
  const stats = [
    { label: 'Submitted', value: analytics.pipeline.storiesSubmitted },
    { label: 'Approved', value: analytics.pipeline.approvedStories },
    { label: 'Distributed', value: analytics.pipeline.fullyDistributed },
  ];

  return (
    <section className="admin-shell-surface-strong rounded-[24px] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
            Newsroom Pipeline
          </p>
          <h2 className="mt-1 text-lg font-bold text-[color:var(--admin-shell-text)]">
            Story to article to video to social
          </h2>
          <p className="mt-1 text-sm text-[color:var(--admin-shell-text-muted)]">
            Compact conversion health for the current desk window.
          </p>
        </div>
        <Link href="/admin/operations" className={SECTION_LINK_CLASS}>
          Open Operations Center
        </Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-[18px] border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface)] p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-shell-text-muted)]">
              {stat.label}
            </p>
            <p className="mt-2 text-2xl font-black text-[color:var(--admin-shell-text)]">
              {formatNumber(stat.value)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TeamHealthSection({
  summary,
  className,
}: {
  summary: TeamHealthSummary | null;
  className?: string;
}) {
  if (!summary) {
    return null;
  }

  const roleOrder: Array<keyof TeamHealthSummary['roleCounts']> = [
    'super_admin',
    'admin',
    'copy_editor',
    'reporter',
  ];

  return (
    <section className={cx(PANEL_CLASS, className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Team Health</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Access coverage, recent sign-ins, and role balance across the leadership-controlled team.
          </p>
        </div>
        <Link href="/admin/team" className={SECTION_LINK_CLASS}>
          Open Team
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className={METRIC_CARD_CLASS}>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Admin Users
          </p>
          <p className="mt-2 text-2xl font-black text-zinc-900 dark:text-zinc-100">
            {formatNumber(summary.totals.adminUsers)}
          </p>
        </div>
        <div className={METRIC_CARD_CLASS}>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Active
          </p>
          <p className="mt-2 text-2xl font-black text-emerald-700">
            {formatNumber(summary.totals.active)}
          </p>
        </div>
        <div className={METRIC_CARD_CLASS}>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Inactive
          </p>
          <p className="mt-2 text-2xl font-black text-amber-700">
            {formatNumber(summary.totals.inactive)}
          </p>
        </div>
        <div className={METRIC_CARD_CLASS}>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Recent Sign-ins
          </p>
          <p className="mt-2 text-2xl font-black text-zinc-900 dark:text-zinc-100">
            {formatNumber(summary.totals.recentLogins7d)}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {roleOrder.map((role) => (
          <span
            key={role}
            className="inline-flex rounded-full border border-zinc-200/80 bg-white/88 px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200"
          >
            {formatUserRoleLabel(role)}: {formatNumber(summary.roleCounts[role] || 0)}
          </span>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {summary.recentMembers.length ? (
          summary.recentMembers.map((member) => (
            <div
              key={member.id || member.email}
              className={cx(
                SOFT_CARD_CLASS,
                'flex items-center justify-between gap-3 transition-all hover:-translate-y-0.5 hover:bg-zinc-100 dark:hover:bg-white/8'
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {member.name}
                </p>
                <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {member.email} / {formatUserRoleLabel(member.role)}
                </p>
              </div>
              <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
                <p>{member.lastLoginAt ? formatUiDate(member.lastLoginAt, member.lastLoginAt) : 'Never signed in'}</p>
                <p className="mt-1">{member.isActive ? 'Active' : 'Inactive'}</p>
              </div>
            </div>
          ))
        ) : (
          <div className={EMPTY_STATE_CLASS}>
            Team health data is not available yet.
          </div>
        )}
      </div>
    </section>
  );
}

function getQuickActions(role: string): QuickAction[] {
  switch (role) {
    case 'reporter':
      return [
        {
          label: 'Create Story',
          description: 'Open a new reporting draft with media, source notes, and desk handoff details.',
          href: '/admin/stories/new',
          icon: FileText,
          tone: 'bg-blue-500/10 text-blue-600',
        },
        {
          label: 'My Work',
          description: 'See your active workflow items and assignments.',
          href: '/admin/my-work',
          icon: Clock3,
          tone: 'bg-amber-500/10 text-amber-600',
        },
        {
          label: 'My Stories',
          description: 'Open the stories you created or the desk assigned back to you.',
          href: '/admin/stories',
          icon: FileText,
          tone: 'bg-rose-500/10 text-rose-600',
        },
        {
          label: 'Media Library',
          description: 'Upload or manage media for current reporting work.',
          href: '/admin/media',
          icon: Video,
          tone: 'bg-emerald-500/10 text-emerald-600',
        },
      ];
    case 'copy_editor':
      return [
        {
          label: 'Copy Desk',
          description: 'Open the dedicated desk for proofreading, fact checks, and headline work.',
          href: '/admin/copy-desk',
          icon: CheckCircle2,
          tone: 'bg-violet-500/10 text-violet-600',
        },
        {
          label: 'My Work',
          description: 'See the items currently assigned to your desk.',
          href: '/admin/my-work',
          icon: Clock3,
          tone: 'bg-amber-500/10 text-amber-600',
        },
        {
          label: 'Article Desk',
          description: 'Manage article workflow, edits, and publish readiness.',
          href: '/admin/articles',
          icon: FileText,
          tone: 'bg-blue-500/10 text-blue-600',
        },
        {
          label: 'E-Paper Desk',
          description: 'Continue page QA and edition production work.',
          href: '/admin/epapers',
          icon: Newspaper,
          tone: 'bg-orange-500/10 text-orange-600',
        },
      ];
    case 'admin':
      return [
        {
          label: 'Content Queue',
          description: 'See the live queue for review, approvals, and release decisions.',
          href: '/admin/content-queue',
          icon: CheckCircle2,
          tone: 'bg-violet-500/10 text-violet-600',
        },
        {
          label: 'Assignments',
          description: 'Manage desk ownership and handoffs across reporting and copy.',
          href: '/admin/assignments',
          icon: FileText,
          tone: 'bg-blue-500/10 text-blue-600',
        },
        {
          label: 'Team',
          description: 'Manage admins, reporters, copy editors, and account setup flow.',
          href: '/admin/team',
          icon: UserCog,
          tone: 'bg-emerald-500/10 text-emerald-600',
        },
        {
          label: 'Push Alerts',
          description: 'Draft newsroom push-alert copy from current high-signal stories.',
          href: '/admin/push-alerts',
          icon: MessageSquare,
          tone: 'bg-orange-500/10 text-orange-600',
        },
      ];
    case 'super_admin':
      return [
        {
          label: 'Analytics',
          description: 'Review content, audience, growth, and reporting performance signals.',
          href: '/admin/analytics',
          icon: BarChart3,
          tone: 'bg-violet-500/10 text-violet-600',
        },
        {
          label: 'Revenue',
          description: 'Open the leadership control surface for revenue and ad readiness.',
          href: '/admin/revenue',
          icon: TrendingUp,
          tone: 'bg-blue-500/10 text-blue-600',
        },
        {
          label: 'Permission Review',
          description: 'Audit role access and leadership-only surfaces.',
          href: '/admin/permission-review',
          icon: AlertTriangle,
          tone: 'bg-emerald-500/10 text-emerald-600',
        },
        {
          label: 'Settings',
          description: 'Control system-level platform and operational settings.',
          href: '/admin/settings',
          icon: Settings,
          tone: 'bg-orange-500/10 text-orange-600',
        },
      ];
    default:
      return [
        {
          label: 'Article Desk',
          description: 'Monitor article output and current editorial flow.',
          href: '/admin/articles',
          icon: FileText,
          tone: 'bg-blue-500/10 text-blue-600',
        },
        {
          label: 'Analytics',
          description: 'Open the monitoring surface for content health.',
          href: '/admin/analytics',
          icon: BarChart3,
          tone: 'bg-emerald-500/10 text-emerald-600',
        },
      ];
  }
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const admin = await getAdminSession();
  if (!admin) {
    redirect('/signin?redirect=/admin');
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const newsroomPipelineFilters = normalizeNewsroomPipelineFilters({
    range: resolveSingleSearchParam(resolvedSearchParams.pipelineRange),
    category: resolveSingleSearchParam(resolvedSearchParams.pipelineCategory),
    reporter: resolveSingleSearchParam(resolvedSearchParams.pipelineReporter),
  });

  const usesLeadershipDashboardData = admin.role === 'super_admin' || admin.role === 'admin';
  const [baseDashboard, myWork, baseReviewQueue, superAdminDashboard, newsroomPipeline] = await Promise.all([
    usesLeadershipDashboardData ? Promise.resolve(null) : getAdminDashboardData(),
    canViewPage(admin.role, 'my_work') ? getMyWorkOverview(admin) : Promise.resolve(null),
    usesLeadershipDashboardData
      ? Promise.resolve(null)
      : canViewPage(admin.role, 'review_queue')
        ? getReviewQueueOverview()
        : Promise.resolve(null),
    usesLeadershipDashboardData ? getSuperAdminDashboardData() : Promise.resolve(null),
    admin.role === 'admin' || admin.role === 'super_admin'
      ? getNewsroomPipelineAnalytics(newsroomPipelineFilters)
      : Promise.resolve(null),
  ]);

  const dashboard = (superAdminDashboard?.dashboard ?? baseDashboard)!;
  const reporterDisplayName = admin.name?.trim() || admin.email?.split('@')[0] || 'Reporter';
  const reporterDeskTitle = `${reporterDisplayName} Desk`;
  const isReporterDashboard = isReporterDeskRole(admin.role);
  const reviewQueue = superAdminDashboard?.reviewQueue ?? baseReviewQueue;
  const epaperInsights = superAdminDashboard?.epaperInsights ?? null;
  const teamHealth = superAdminDashboard?.teamHealth ?? null;
  const quickActions = getQuickActions(admin.role);
  const myItems = myWork?.items || [];
  const reviewItems = reviewQueue?.items || [];
  const superAdminMetrics = superAdminDashboard?.metrics || null;
  const deskAssignedCount =
    Number(myWork?.counts.assigned || 0) +
    Number(myWork?.counts.in_review || 0) +
    Number(myWork?.counts.copy_edit || 0) +
    Number(myWork?.productionCounts.pages_ready || 0) +
    Number(myWork?.productionCounts.ocr_review || 0) +
    Number(myWork?.productionCounts.hotspot_mapping || 0) +
    Number(myWork?.productionCounts.qa_review || 0) +
    Number(myWork?.productionCounts.ready_to_publish || 0);
  const reporterActiveDeskCount =
    Number(myWork?.counts.assigned || 0) +
    Number(myWork?.counts.in_review || 0) +
    Number(myWork?.counts.copy_edit || 0);
  const readyEditionCount =
    superAdminDashboard?.metrics.readyEditionCount ||
    Number(reviewQueue?.productionCounts.ready_to_publish || 0);
  const activeEditionCount =
    superAdminDashboard?.metrics.activeEditionCount ||
    Number(reviewQueue?.productionCounts.pages_ready || 0) +
      Number(reviewQueue?.productionCounts.ocr_review || 0) +
      Number(reviewQueue?.productionCounts.hotspot_mapping || 0) +
      Number(reviewQueue?.productionCounts.qa_review || 0);
  const readyToPublishItems = reviewItems.filter(
    (item) =>
      item.status === 'ready_for_approval' ||
      item.status === 'approved' ||
      item.status === 'scheduled' ||
      item.status === 'ready_to_publish'
  );
  const activeReviewItems = reviewItems.filter(
    (item) =>
      item.status !== 'ready_for_approval' &&
      item.status !== 'approved' &&
      item.status !== 'scheduled' &&
      item.status !== 'ready_to_publish'
  );
  const leadershipAlerts = superAdminDashboard?.leadershipAlerts || [];

  const statCards: StatCardConfig[] =
    isReporterDeskRole(admin.role)
      ? [
          {
            label: 'My Drafts',
            value: Number(myWork?.counts.draft || 0),
            note: 'Stories still being shaped before desk handoff.',
            icon: FileText,
            tone: 'bg-blue-500/15 text-blue-600',
          },
          {
            label: 'Submitted',
            value: Number(myWork?.counts.submitted || 0),
            note: 'Waiting for assignment or first editorial action.',
            icon: Clock3,
            tone: 'bg-violet-500/15 text-violet-600',
          },
          {
            label: 'With Desk',
            value: reporterActiveDeskCount,
            note: 'Stories actively assigned, reviewed, or copy-checked by the desk right now.',
            icon: CheckCircle2,
            tone: 'bg-amber-500/15 text-amber-600',
          },
          {
            label: 'Changes Requested',
            value: Number(myWork?.counts.changes_requested || 0),
            note: 'Desk items sent back to you for updates before approval.',
            icon: AlertTriangle,
            tone: 'bg-rose-500/15 text-rose-600',
          },
        ]
      : admin.role === 'copy_editor'
        ? [
            {
              label: 'Submitted',
              value: Number(reviewQueue?.counts.submitted || 0),
              note: 'Reporter-created items waiting for desk pickup.',
              icon: Inbox,
              tone: 'bg-violet-500/15 text-violet-600',
            },
            {
              label: 'In Review',
              value:
                Number(reviewQueue?.counts.in_review || 0) +
                Number(reviewQueue?.counts.copy_edit || 0) +
                activeEditionCount,
              note: 'Content review plus active e-paper production work.',
              icon: CheckCircle2,
              tone: 'bg-amber-500/15 text-amber-600',
            },
            {
              label: 'Ready To Publish',
              value: dashboard.workflow.readyToPublish + readyEditionCount,
              note: 'Approved content and ready editions waiting for release decisions.',
              icon: Clock3,
              tone: 'bg-blue-500/15 text-blue-600',
            },
            {
              label: 'Assigned To Me',
              value: deskAssignedCount,
              note: 'Your active copy desk and edition workload right now.',
              icon: FileText,
              tone: 'bg-orange-500/15 text-orange-600',
            },
          ]
        : admin.role === 'admin'
          ? [
              {
                label: 'Needs Review',
                value: dashboard.workflow.needsReview + activeEditionCount,
                note: 'Workflow pressure currently sitting in the content and edition queues.',
                icon: Inbox,
                tone: 'bg-violet-500/15 text-violet-600',
              },
              {
                label: 'Ready To Publish',
                value: dashboard.workflow.readyToPublish + readyEditionCount,
                note: 'Approved content and ready editions awaiting final release.',
                icon: CheckCircle2,
                tone: 'bg-blue-500/15 text-blue-600',
              },
              {
                label: 'Editions In Production',
                value: activeEditionCount + readyEditionCount,
                note: 'E-paper editions actively moving through OCR, QA, and publish readiness.',
                icon: Newspaper,
                tone: 'bg-emerald-500/15 text-emerald-600',
              },
              {
                label: 'New Messages',
                value: dashboard.inbox.new,
                note: 'Inbox items still waiting for admin response.',
                icon: MessageSquare,
                tone: 'bg-orange-500/15 text-orange-600',
              },
            ]
          : admin.role === 'super_admin'
            ? [
                {
                  label: 'Content Inventory',
                  value:
                    superAdminDashboard?.metrics.contentInventory ||
                    dashboard.stats.totalArticles +
                      dashboard.stats.totalVideos +
                      dashboard.stats.totalEPapers,
                  note: 'Total articles, videos, and e-paper editions under platform oversight.',
                  icon: Newspaper,
                  tone: 'bg-blue-500/15 text-blue-600',
                },
                {
                  label: 'Workflow Pressure',
                  value:
                    superAdminDashboard?.metrics.workflowPressure ||
                    dashboard.workflow.needsReview + activeEditionCount,
                  note: 'Editorial and edition work currently needing desk attention.',
                  icon: Inbox,
                  tone: 'bg-violet-500/15 text-violet-600',
                },
                {
                  label: 'Ready Decisions',
                  value:
                    superAdminDashboard?.metrics.readyDecisions ||
                    dashboard.workflow.readyToPublish + readyEditionCount,
                  note: 'Content and editions cleared and waiting for leadership release decisions.',
                  icon: CheckCircle2,
                  tone: 'bg-emerald-500/15 text-emerald-600',
                },
                {
                  label: 'Blocked Editions',
                  value: superAdminDashboard?.metrics.blockedEditions || epaperInsights?.blockedEditions.length || 0,
                  note: 'E-paper editions still blocked by QA, hotspot, or extraction issues.',
                  icon: AlertTriangle,
                  tone: 'bg-orange-500/15 text-orange-600',
                },
                {
                  label: 'Inbox Escalations',
                  value: superAdminDashboard?.metrics.inboxEscalations || dashboard.inbox.new,
                  note: 'Reader or operations messages still waiting for leadership visibility.',
                  icon: MessageSquare,
                  tone: 'bg-rose-500/15 text-rose-600',
                },
                {
                  label: 'Team Coverage',
                  value: superAdminDashboard?.metrics.teamCoverage || teamHealth?.totals.active || 0,
                  note: 'Active admin-side team members currently available across the desk.',
                  icon: UserCog,
                  tone: 'bg-cyan-500/15 text-cyan-600',
                },
              ]
            : [
                {
                  label: 'Articles',
                  value: dashboard.stats.totalArticles,
                  note: 'Current article inventory available for monitoring.',
                  icon: FileText,
                  tone: 'bg-blue-500/15 text-blue-600',
                },
                {
                  label: 'Needs Review',
                  value: dashboard.workflow.needsReview,
                  note: 'Workflow items still moving through the editorial desk.',
                  icon: Inbox,
                  tone: 'bg-violet-500/15 text-violet-600',
                },
                {
                  label: 'Published Videos',
                  value: dashboard.stats.totalVideos,
                  note: 'Video stories currently live on the platform.',
                  icon: Video,
                  tone: 'bg-emerald-500/15 text-emerald-600',
                },
                {
                  label: 'E-Papers',
                  value: dashboard.stats.totalEPapers,
                  note: 'Published editions available to readers.',
                  icon: Newspaper,
                  tone: 'bg-orange-500/15 text-orange-600',
                },
              ];

  return (
    <div className={cx('space-y-4 sm:space-y-6', admin.role === 'super_admin' && 'mx-auto max-w-[1580px] sm:space-y-8')}>
      {admin.role === 'super_admin' ? (
        <LeadershipHeroSection
          metrics={{
            readyDecisions: superAdminMetrics?.readyDecisions || dashboard.workflow.readyToPublish + readyEditionCount,
            blockedEditions: superAdminMetrics?.blockedEditions || epaperInsights?.blockedEditions.length || 0,
            teamCoverage: superAdminMetrics?.teamCoverage || teamHealth?.totals.active || 0,
            reportingAlerts: superAdminMetrics?.reportingAlerts || 0,
          }}
          alerts={leadershipAlerts}
          quickActions={quickActions}
        />
      ) : (
        <>
          <section className={PANEL_CLASS}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600">
                  {formatNewsroomRoleLabel(admin.role)}
                </p>
                <h1 className="mt-2 text-2xl font-black text-zinc-900 dark:text-zinc-100 sm:text-3xl">
                  {isReporterDashboard
                    ? reporterDeskTitle
                    : admin.role === 'copy_editor'
                      ? 'Copy Editor Dashboard'
                      : 'Newsroom Dashboard'}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  {isReporterDashboard
                    ? 'Create story drafts, track desk feedback, and stay on top of your active reporting queue.'
                    : admin.role === 'copy_editor'
                      ? 'Pick up submitted stories, review assigned work, and send clean items to admin approval.'
                      : admin.role === 'admin'
                        ? 'See queue pressure, publish-ready work, edition production, inbox load, and editorial operations first.'
                        : 'See newsroom output and live workflow pressure at a glance.'}
                </p>
              </div>
            </div>
          </section>

          {isReporterDashboard ? (
            <section
              className={cx(
                'grid gap-4 xl:grid-cols-4',
                isReporterDashboard ? 'grid-cols-2' : 'hidden grid-cols-1 md:grid md:grid-cols-2'
              )}
            >
              {quickActions.map((action) => (
                <QuickActionCard key={action.href} action={action} compactOnMobile={isReporterDashboard} />
              ))}
            </section>
          ) : null}
        </>
      )}

      <section
        className={cx(
          'grid gap-4',
          admin.role === 'super_admin'
            ? 'grid-cols-2 md:grid-cols-2 xl:grid-cols-6'
            : isReporterDashboard
              ? 'grid-cols-2 xl:grid-cols-4'
              : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'
        )}
      >
        {statCards.map((stat) =>
          admin.role === 'super_admin' ? (
            <LeadershipStatCard key={stat.label} stat={stat} />
          ) : (
            <StatCard
              key={stat.label}
              stat={stat}
              compactOnMobile={isReporterDashboard || admin.role === 'copy_editor'}
            />
          )
        )}
      </section>

      {newsroomPipeline && (admin.role === 'admin' || admin.role === 'super_admin') ? (
        <PipelineSummarySection analytics={newsroomPipeline} />
      ) : null}

      {isReporterDashboard ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <WorkflowListSection
            title="My Reporting Queue"
            description="Drafts, submissions, and assigned items currently tied to your reporting workflow."
            href="/admin/my-work"
            linkLabel="Open My Work"
            items={myItems}
            emptyMessage="No owned or assigned workflow items yet. New drafts and submissions will appear here."
            compactOnMobile
          />
          <section className={PANEL_CLASS}>
            <h2 className="text-xl font-bold text-[var(--admin-shell-text)]">Submission Status</h2>
            <p className="mt-1 text-sm text-[var(--admin-shell-text-muted)]">
              Track where your filed work is sitting with the desk right now.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-4">
              <div className={COMPACT_METRIC_CARD_CLASS}>
                <p className="text-[10px] font-semibold uppercase leading-4 tracking-wide text-[var(--admin-shell-text-muted)] sm:text-xs">
                  Waiting With Desk
                </p>
                <p className="mt-2 text-xl font-bold text-[var(--admin-shell-text)] sm:text-2xl">
                  {formatNumber(Number(myWork?.counts.submitted || 0))}
                </p>
              </div>
              <div className={COMPACT_METRIC_CARD_CLASS}>
                <p className="text-[10px] font-semibold uppercase leading-4 tracking-wide text-[var(--admin-shell-text-muted)] sm:text-xs">
                  In Review
                </p>
                <p className="mt-2 text-xl font-bold text-[var(--admin-shell-text)] sm:text-2xl">
                  {formatNumber(
                    Number(myWork?.counts.assigned || 0) +
                      Number(myWork?.counts.in_review || 0) +
                      Number(myWork?.counts.copy_edit || 0)
                  )}
                </p>
              </div>
              <div className={COMPACT_METRIC_CARD_CLASS}>
                <p className="text-[10px] font-semibold uppercase leading-4 tracking-wide text-[var(--admin-shell-text-muted)] sm:text-xs">
                  Changes Requested
                </p>
                <p className="mt-2 text-xl font-bold text-[var(--admin-shell-text)] sm:text-2xl">
                  {formatNumber(Number(myWork?.counts.changes_requested || 0))}
                </p>
              </div>
              <div className={COMPACT_METRIC_CARD_CLASS}>
                <p className="text-[10px] font-semibold uppercase leading-4 tracking-wide text-[var(--admin-shell-text-muted)] sm:text-xs">
                  Published
                </p>
                <p className="mt-2 text-xl font-bold text-[var(--admin-shell-text)] sm:text-2xl">
                  {formatNumber(Number(myWork?.counts.published || 0))}
                </p>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {admin.role === 'copy_editor' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <WorkflowListSection
            title="Copy Desk Queue"
            description="Submitted stories waiting for pickup and active copy desk review."
            href="/admin/copy-desk"
            linkLabel="Open Copy Desk"
            items={activeReviewItems}
            emptyMessage="No submitted stories are waiting right now."
            compactOnMobile
          />
          <WorkflowListSection
            title="My Desk"
            description="Items currently assigned to you or created from your desk."
            href="/admin/my-work"
            linkLabel="Open My Work"
            items={myItems}
            emptyMessage="No current desk items are assigned to you yet."
            compactOnMobile
          />
        </div>
      ) : null}

      {admin.role === 'copy_editor' ? (
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {quickActions.map((action) => (
            <QuickActionCard key={action.href} action={action} compactOnMobile />
          ))}
        </section>
      ) : null}

      {admin.role === 'admin' ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-[1.15fr,1fr]">
            <div className="space-y-6">
              <WorkflowListSection
                title="Ready To Publish"
                description="Approved content and ready editions waiting for release decisions."
                href="/admin/content-queue"
                linkLabel="Open Content Queue"
                items={readyToPublishItems}
                emptyMessage="No content or editions are waiting for publish decisions right now."
                compactOnMobile
              />
              <WorkflowListSection
                title="Live Review Queue"
                description="Current queue pressure still moving through editorial and production workflow."
                href="/admin/assignments"
                linkLabel="Open Assignments"
                items={activeReviewItems}
                emptyMessage="The live review queue is clear right now."
                compactOnMobile
                desktopTable
              />
            </div>
            <InboxSnapshot counts={dashboard.inbox} />
          </div>

          <section className="admin-shell-surface-strong rounded-[24px] p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
                  Operations Center
                </p>
                <h2 className="mt-1 text-lg font-bold text-[color:var(--admin-shell-text)]">
                  Decisions, risks, quality, and growth live in one focused workspace.
                </h2>
              </div>
              <Link href="/admin/operations" className={SECTION_LINK_CLASS}>
                Open Operations Center
              </Link>
            </div>
          </section>
        </>
      ) : null}

      {admin.role === 'super_admin' ? (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-[1fr,1fr]">
          <TeamHealthSection summary={teamHealth} />
          <InboxSnapshot counts={dashboard.inbox} className="hidden sm:block" />
        </div>
      ) : null}

      {!['reporter', 'copy_editor', 'admin', 'super_admin'].includes(admin.role) ? (
        <div className={EMPTY_STATE_CLASS}>
          <p className="text-sm text-[var(--admin-shell-text-muted)]">
            No dashboard variant is configured for this role yet.
          </p>
        </div>
      ) : null}

    </div>
  );
}
