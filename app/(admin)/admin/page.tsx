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
import {
  getSuperAdminDashboardData,
  type SuperAdminAlert,
  type SuperAdminActionGroup,
  type SuperAdminGrowthHighlight,
} from '@/lib/admin/superAdminDashboard';
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
  'admin-shell-toolbar-btn inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em]';

const PANEL_CLASS =
  'admin-shell-surface-strong rounded-[32px] p-6';

const SOFT_CARD_CLASS =
  'admin-shell-surface-muted rounded-[24px] p-4 shadow-[0_18px_48px_-40px_rgba(15,23,42,0.12)] dark:shadow-[0_18px_48px_-40px_rgba(0,0,0,0.4)]';

const METRIC_CARD_CLASS =
  'admin-shell-surface rounded-[22px] p-4 shadow-sm';

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

function formatSeverityLabel(severity: SuperAdminAlert['severity']) {
  switch (severity) {
    case 'critical':
      return 'Critical';
    case 'warning':
      return 'Warning';
    case 'info':
    default:
      return 'Info';
  }
}

function getSeverityToneClass(severity: SuperAdminAlert['severity']) {
  switch (severity) {
    case 'critical':
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
    case 'info':
    default:
      return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300';
  }
}

function QuickActionCard({ action }: { action: QuickAction }) {
  const Icon = action.icon;

  return (
    <Link
      href={action.href}
      className="admin-shell-surface rounded-3xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--admin-shell-shadow-strong)]"
    >
      <div className={`inline-flex rounded-2xl p-3 ${action.tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-[color:var(--admin-shell-text)]">
        {action.label}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[color:var(--admin-shell-text-muted)]">
        {action.description}
      </p>
    </Link>
  );
}

function StatCard({ stat }: { stat: StatCardConfig }) {
  return (
    <div className="admin-shell-surface rounded-3xl p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[color:var(--admin-shell-text-muted)]">{stat.label}</p>
          <p className="mt-3 text-3xl font-black text-[color:var(--admin-shell-text)]">
            {formatNumber(stat.value)}
          </p>
        </div>
        <div className={`rounded-2xl p-3 ${stat.tone}`}>
          <stat.icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm text-[color:var(--admin-shell-text-muted)]">{stat.note}</p>
    </div>
  );
}

function formatRate(count: number, total: number) {
  if (total <= 0) return '0%';
  return `${Math.round((count / total) * 100)}%`;
}

function resolveSingleSearchParam(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : Array.isArray(value) ? value[0] : undefined;
}

function getPipelineRangeLabel(range: NewsroomPipelineAnalytics['filters']['applied']['range']) {
  switch (range) {
    case '7d':
      return 'Last 7 days';
    case '30d':
      return 'Last 30 days';
    case '90d':
      return 'Last 90 days';
    case '365d':
      return 'Last 365 days';
    case 'all':
    default:
      return 'All time';
  }
}

function PipelineMetricCard({
  label,
  count,
  total,
  note,
  icon: Icon,
}: {
  label: string;
  count: number;
  total: number;
  note: string;
  icon: LucideIcon;
}) {
  return (
    <div className={METRIC_CARD_CLASS}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-shell-text-muted)]">
            {label}
          </p>
          <p className="mt-2 text-2xl font-black text-[color:var(--admin-shell-text)]">
            {formatNumber(count)}
          </p>
          <p className="mt-1 text-xs font-medium text-[color:var(--admin-shell-text-muted)]">
            {formatRate(count, total)}
          </p>
        </div>
        <div className="rounded-2xl bg-red-500/10 p-3 text-red-600 dark:bg-red-500/15 dark:text-red-300">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-[color:var(--admin-shell-text-muted)]">{note}</p>
    </div>
  );
}

function NewsroomPipelineFiltersBar({
  analytics,
}: {
  analytics: NewsroomPipelineAnalytics;
}) {
  const activeFilters = [
    getPipelineRangeLabel(analytics.filters.applied.range),
    analytics.filters.applied.category
      ? `Category: ${analytics.filters.applied.category}`
      : null,
    analytics.filters.applied.reporter
      ? `Reporter: ${analytics.filters.applied.reporter}`
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className={SOFT_CARD_CLASS}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-shell-text-muted)]">
            Filters
          </p>
          <h3 className="mt-2 text-lg font-bold text-[color:var(--admin-shell-text)]">
            Inspect pipeline health by period, category, and reporter
          </h3>
          <p className="mt-1 text-sm text-[color:var(--admin-shell-text-muted)]">
            Narrow the pipeline to one desk lane so bottlenecks are easier to spot and act on quickly.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((filter) => (
            <span
              key={filter}
              className="rounded-full border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--admin-shell-text-muted)]"
            >
              {filter}
            </span>
          ))}
        </div>
      </div>

      <form
        action="/admin"
        method="get"
        className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr,1fr,1fr,auto,auto] lg:items-end"
      >
        <label className="space-y-2 text-sm font-medium text-[color:var(--admin-shell-text)]">
          <span>Time Window</span>
          <select
            name="pipelineRange"
            defaultValue={analytics.filters.applied.range}
            className="admin-shell-input w-full rounded-2xl px-4 py-3 text-sm"
          >
            <option value="all">All time</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="365d">Last 365 days</option>
          </select>
        </label>

        <label className="space-y-2 text-sm font-medium text-[color:var(--admin-shell-text)]">
          <span>Category</span>
          <select
            name="pipelineCategory"
            defaultValue={analytics.filters.applied.category}
            className="admin-shell-input w-full rounded-2xl px-4 py-3 text-sm"
          >
            <option value="">All categories</option>
            {analytics.filters.options.categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm font-medium text-[color:var(--admin-shell-text)]">
          <span>Reporter / Desk Owner</span>
          <select
            name="pipelineReporter"
            defaultValue={analytics.filters.applied.reporter}
            className="admin-shell-input w-full rounded-2xl px-4 py-3 text-sm"
          >
            <option value="">All reporters</option>
            {analytics.filters.options.reporters.map((reporter) => (
              <option key={reporter} value={reporter}>
                {reporter}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="admin-shell-toolbar-btn inline-flex min-h-[52px] items-center justify-center rounded-2xl px-5 text-sm font-semibold"
        >
          Apply Filters
        </button>

        <Link
          href="/admin"
          className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-[color:var(--admin-shell-border)] px-5 text-sm font-semibold text-[color:var(--admin-shell-text-muted)] transition-colors hover:text-[color:var(--admin-shell-text)]"
        >
          Reset
        </Link>
      </form>
    </div>
  );
}

function NewsroomPipelineSection({
  analytics,
}: {
  analytics: NewsroomPipelineAnalytics;
}) {
  const approvedBase = analytics.pipeline.approvedStories;
  const statusCards = [
    {
      label: 'Approved Stories',
      count: analytics.pipeline.approvedStories,
      note: 'Story packages cleared by the newsroom and ready to become outputs.',
      icon: CheckCircle2,
    },
    {
      label: 'Linked Articles',
      count: analytics.pipeline.linkedArticleCreated,
      note: 'Approved stories that already have a primary linked website article.',
      icon: FileText,
    },
    {
      label: 'Published Articles',
      count: analytics.pipeline.linkedArticlePublished,
      note: 'Linked stories whose primary article is already live to readers.',
      icon: ArrowUpRight,
    },
    {
      label: 'Video Ready',
      count: analytics.pipeline.videoReady,
      note: 'Stories with final edited exports ready for distribution and social drafting.',
      icon: Video,
    },
    {
      label: 'Social Published',
      count: analytics.pipeline.socialPublished,
      note: 'Stories that already have at least one published social-media distribution record.',
      icon: BarChart3,
    },
  ];

  const bottlenecks = [
    {
      label: 'Awaiting Article',
      value: analytics.bottlenecks.awaitingArticle,
      note: 'Approved stories without a linked article yet.',
    },
    {
      label: 'Awaiting Video',
      value: analytics.bottlenecks.awaitingVideo,
      note: 'Linked stories that still need video production to start.',
    },
    {
      label: 'Awaiting Social Drafts',
      value: analytics.bottlenecks.awaitingSocialDrafts,
      note: 'Video-ready stories that have not generated outbox drafts yet.',
    },
    {
      label: 'Awaiting Social Publish',
      value: analytics.bottlenecks.awaitingSocialPublish,
      note: 'Stories with drafts in the outbox but no published platform post yet.',
    },
  ];

  return (
    <section className={PANEL_CLASS}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600">
            Newsroom Pipeline
          </p>
          <h2 className="mt-2 text-2xl font-black text-[color:var(--admin-shell-text)]">
            Story To Article To Video To Social
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--admin-shell-text-muted)]">
            One place to see how approved reporter stories are being converted into website
            articles, edited video outputs, and social distribution.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-shell-text-muted)]">
          <span className="rounded-full border border-[color:var(--admin-shell-border)] px-3 py-2">
            Source: {analytics.source}
          </span>
          <span className="rounded-full border border-[color:var(--admin-shell-border)] px-3 py-2">
            Submitted Stories: {formatNumber(analytics.pipeline.storiesSubmitted)}
          </span>
          <span className="rounded-full border border-[color:var(--admin-shell-border)] px-3 py-2">
            Fully Distributed: {formatNumber(analytics.pipeline.fullyDistributed)}
          </span>
        </div>
      </div>

      <div className="mt-6">
        <NewsroomPipelineFiltersBar analytics={analytics} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-5">
        {statusCards.map((card) => (
          <PipelineMetricCard
            key={card.label}
            label={card.label}
            count={card.count}
            total={approvedBase}
            note={card.note}
            icon={card.icon}
          />
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <div className={SOFT_CARD_CLASS}>
          <p className="text-sm font-semibold text-[color:var(--admin-shell-text)]">
            Pipeline Bottlenecks
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {bottlenecks.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface)] p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-shell-text-muted)]">
                  {item.label}
                </p>
                <p className="mt-2 text-2xl font-black text-[color:var(--admin-shell-text)]">
                  {formatNumber(item.value)}
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--admin-shell-text-muted)]">
                  {item.note}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className={SOFT_CARD_CLASS}>
          <p className="text-sm font-semibold text-[color:var(--admin-shell-text)]">
            Social Outbox Status
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Object.entries(analytics.socialStatuses).map(([status, value]) => (
              <div
                key={status}
                className="rounded-2xl border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface)] p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-shell-text-muted)]">
                  {formatStatusLabel(status)}
                </p>
                <p className="mt-2 text-2xl font-black text-[color:var(--admin-shell-text)]">
                  {formatNumber(value)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-[color:var(--admin-shell-text-muted)]">
            <div className="rounded-2xl border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em]">Linked Articles</p>
              <p className="mt-2 text-2xl font-black text-[color:var(--admin-shell-text)]">
                {formatNumber(analytics.totals.linkedArticles)}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em]">Direct Articles</p>
              <p className="mt-2 text-2xl font-black text-[color:var(--admin-shell-text)]">
                {formatNumber(analytics.totals.directArticles)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LeadershipActionCard({ action }: { action: QuickAction }) {
  const Icon = action.icon;

  return (
    <Link
      href={action.href}
      className="group admin-shell-surface relative overflow-hidden rounded-[28px] p-5 transition-all hover:-translate-y-1 hover:border-red-400/30 hover:shadow-[0_34px_90px_-40px_rgba(220,38,38,0.18)] dark:hover:shadow-[0_34px_90px_-40px_rgba(220,38,38,0.28)]"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent dark:via-white/15" />
      <div className="flex items-start justify-between gap-4">
        <div className={cx('inline-flex rounded-2xl p-3 ring-1 ring-black/5 dark:ring-white/10', action.tone)}>
          <Icon className="h-5 w-5" />
        </div>
        <ArrowUpRight className="h-4 w-4 text-zinc-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-red-500 dark:text-zinc-500" />
      </div>
      <div className="mt-5">
        <p className="text-base font-bold text-[color:var(--admin-shell-text)]">{action.label}</p>
        <p className="mt-2 text-sm leading-6 text-[color:var(--admin-shell-text-muted)]">
          {action.description}
        </p>
      </div>
    </Link>
  );
}

function LeadershipStatCard({ stat }: { stat: StatCardConfig }) {
  return (
    <div className="group admin-shell-surface relative overflow-hidden rounded-[28px] p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--admin-shell-shadow-strong)]">
      <div className={cx('pointer-events-none absolute -right-5 -top-5 h-24 w-24 rounded-full opacity-20 blur-2xl', stat.tone)} />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent dark:via-white/20" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-shell-text-muted)]">
            {stat.label}
          </p>
          <p className="mt-4 text-4xl font-black tracking-tight text-[color:var(--admin-shell-text)]">
            {formatNumber(stat.value)}
          </p>
        </div>
        <div className={cx('rounded-2xl p-3 ring-1 ring-black/5 dark:ring-white/10', stat.tone)}>
          <stat.icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-[color:var(--admin-shell-text-muted)]">{stat.note}</p>
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
    <section className="relative overflow-hidden rounded-[36px] border border-[color:var(--admin-shell-border-strong)] bg-[linear-gradient(135deg,rgba(255,252,247,0.96),rgba(248,241,232,0.95)_48%,rgba(243,238,230,0.98)_100%)] p-8 shadow-[var(--admin-shell-shadow-strong)] dark:bg-[linear-gradient(135deg,rgba(18,18,22,0.98),rgba(32,22,18,0.96)_42%,rgba(15,19,33,0.98)_100%)] lg:p-10">
      <div className="pointer-events-none absolute -right-10 top-0 h-48 w-48 rounded-full bg-red-500/12 blur-3xl dark:bg-red-500/16" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 rounded-full bg-amber-400/12 blur-3xl dark:bg-amber-400/10" />

      <div className="relative grid gap-8 xl:grid-cols-[1.45fr,0.8fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
            Super Admin
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-[color:var(--admin-shell-text)] sm:text-5xl">
            Leadership Dashboard
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[color:var(--admin-shell-text-muted)] sm:text-[15px]">
            Track release readiness, blocked operations, reporting health, team coverage, and
            growth across the newsroom.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {statusChips.map((chip) => (
              <div
                key={chip.label}
                className="admin-shell-surface rounded-2xl px-4 py-3 shadow-sm"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--admin-shell-text-muted)]">
                  {chip.label}
                </p>
                <p className="mt-1 text-lg font-black text-[color:var(--admin-shell-text)]">
                  {formatNumber(chip.value)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
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

      <div className="relative mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
}: {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  items: WorkflowArticleCard[];
  emptyMessage: string;
  className?: string;
}) {
  const visibleItems = items.slice(0, 4);

  return (
    <section className={cx(PANEL_CLASS, className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{description}</p>
        </div>
        <Link href={href} className={SECTION_LINK_CLASS}>
          {linkLabel}
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {visibleItems.length ? (
          visibleItems.map((item) => (
            <Link
              key={`${item.contentType}-${item.id}`}
              href={item.editHref}
              className={cx(
                SOFT_CARD_CLASS,
                'flex flex-col gap-3 transition-all hover:-translate-y-0.5 hover:bg-zinc-100 dark:hover:bg-white/8'
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {item.category} / {item.author} / {formatContentTypeLabel(item.contentType)}
                  </p>
                </div>
                <WorkflowPill status={item.status} />
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                <span>Updated {formatUiDate(item.updatedAt, item.updatedAt)}</span>
                {item.assignedToName ? <span>Assignee: {item.assignedToName}</span> : null}
                {item.createdByName ? <span>Created by: {item.createdByName}</span> : null}
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

function ArticleListSection({
  title,
  description,
  href,
  linkLabel,
  items,
  emptyMessage,
}: {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  items: Array<{ id: string; title: string; category: string; author: string; publishedAt: string; views: number }>;
  emptyMessage: string;
}) {
  return (
    <section className={PANEL_CLASS}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[color:var(--admin-shell-text)]">{title}</h2>
          <p className="mt-1 text-sm text-[color:var(--admin-shell-text-muted)]">{description}</p>
        </div>
        <Link href={href} className={SECTION_LINK_CLASS}>
          {linkLabel}
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {items.length ? (
          items.map((article) => (
            <Link
              key={article.id}
              href={`/admin/articles/${encodeURIComponent(article.id)}/edit`}
              className={cx(SOFT_CARD_CLASS, 'flex items-center justify-between gap-3 transition-colors hover:-translate-y-0.5')}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[color:var(--admin-shell-text)]">
                  {article.title}
                </p>
                <p className="mt-1 text-xs text-[color:var(--admin-shell-text-muted)]">
                  {article.category} / {article.author}
                </p>
              </div>
              <div className="text-right text-xs text-[color:var(--admin-shell-text-muted)]">
                <p>{formatUiDate(article.publishedAt, article.publishedAt)}</p>
                <p className="mt-1">{formatNumber(article.views)} views</p>
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

function VideoListSection({
  items,
}: {
  items: Array<{ id: string; title: string; category: string; publishedAt: string; views: number }>;
}) {
  return (
    <section className={PANEL_CLASS}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[color:var(--admin-shell-text)]">Recent Videos</h2>
          <p className="mt-1 text-sm text-[color:var(--admin-shell-text-muted)]">
            Published video output currently live on the site.
          </p>
        </div>
        <Link href="/admin/videos" className={SECTION_LINK_CLASS}>
          Open Videos
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {items.length ? (
          items.map((video) => (
            <Link
              key={video.id}
              href="/admin/videos"
              className={cx(SOFT_CARD_CLASS, 'flex items-center justify-between gap-3 transition-colors hover:-translate-y-0.5')}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[color:var(--admin-shell-text)]">
                  {video.title}
                </p>
                <p className="mt-1 text-xs text-[color:var(--admin-shell-text-muted)]">
                  {video.category}
                </p>
              </div>
              <div className="text-right text-xs text-[color:var(--admin-shell-text-muted)]">
                <p>{formatUiDate(video.publishedAt, video.publishedAt)}</p>
                <p className="mt-1">{formatNumber(video.views)} views</p>
              </div>
            </Link>
          ))
        ) : (
          <div className={EMPTY_STATE_CLASS}>
            No recent videos yet.
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

function DecisionCenterSection({
  readyDecisionItems,
  blockedEditionItems,
  alerts,
}: {
  readyDecisionItems: WorkflowArticleCard[];
  blockedEditionItems: Array<{
    epaperId: string;
    title: string;
    cityName: string;
    productionStatus: string;
    blockerCount: number;
    blockers: string[];
    editHref: string;
  }>;
  alerts: SuperAdminAlert[];
}) {
  const visibleReadyDecisionItems = readyDecisionItems.slice(0, 4);
  const visibleBlockedEditionItems = blockedEditionItems.slice(0, 4);
  const visibleAlerts = alerts.slice(0, 5);

  return (
    <section className={PANEL_CLASS}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Decision Center</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Leadership-ready publishing decisions, edition blockers, and urgent escalations from across the newsroom.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/review-queue" className={SECTION_LINK_CLASS}>
            Open Review Queue
          </Link>
          <Link href="/admin/epapers" className={SECTION_LINK_CLASS}>
            Open E-Papers
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className={METRIC_CARD_CLASS}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Ready Decisions
          </p>
          <p className="mt-2 text-2xl font-black text-zinc-950 dark:text-zinc-50">
            {formatNumber(readyDecisionItems.length)}
          </p>
        </div>
        <div className={METRIC_CARD_CLASS}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Edition Blockers
          </p>
          <p className="mt-2 text-2xl font-black text-zinc-950 dark:text-zinc-50">
            {formatNumber(blockedEditionItems.length)}
          </p>
        </div>
        <div className={METRIC_CARD_CLASS}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Urgent Signals
          </p>
          <p className="mt-2 text-2xl font-black text-zinc-950 dark:text-zinc-50">
            {formatNumber(alerts.length)}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr,1.05fr,0.95fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Ready Decisions
            </h3>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              {formatNumber(readyDecisionItems.length)}
            </span>
          </div>
          {visibleReadyDecisionItems.length ? (
            visibleReadyDecisionItems.map((item) => (
              <Link
                key={`${item.contentType}-${item.id}`}
                href={item.editHref}
                className={cx(
                  SOFT_CARD_CLASS,
                  'block transition-all hover:-translate-y-0.5 hover:bg-zinc-100 dark:hover:bg-white/10'
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {item.category} / {formatContentTypeLabel(item.contentType)}
                    </p>
                  </div>
                  <WorkflowPill status={item.status} />
                </div>
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                  Updated {formatUiDate(item.updatedAt, item.updatedAt)}
                </p>
              </Link>
            ))
          ) : (
            <div className={EMPTY_STATE_CLASS}>
              No content is waiting for leadership release decisions right now.
            </div>
          )}
          {readyDecisionItems.length > visibleReadyDecisionItems.length ? (
            <p className="px-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              +{formatNumber(readyDecisionItems.length - visibleReadyDecisionItems.length)} more items are waiting in the release queue.
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Blocked Editions
            </h3>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
              {formatNumber(blockedEditionItems.length)}
            </span>
          </div>
          {visibleBlockedEditionItems.length ? (
            visibleBlockedEditionItems.map((edition) => (
              <Link
                key={edition.epaperId}
                href={edition.editHref}
                className={cx(
                  SOFT_CARD_CLASS,
                  'block transition-all hover:-translate-y-0.5 hover:bg-zinc-100 dark:hover:bg-white/10'
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {edition.title}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {edition.cityName} / {edition.blockerCount} blocker{edition.blockerCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <WorkflowPill status={edition.productionStatus} />
                </div>
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                  {edition.blockers[0] || 'Edition needs QA or hotspot cleanup before release.'}
                </p>
              </Link>
            ))
          ) : (
            <div className={EMPTY_STATE_CLASS}>
              No blocked editions are waiting on leadership review right now.
            </div>
          )}
          {blockedEditionItems.length > visibleBlockedEditionItems.length ? (
            <p className="px-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              +{formatNumber(blockedEditionItems.length - visibleBlockedEditionItems.length)} more blocked editions need review.
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Urgent Alerts
            </h3>
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {formatNumber(alerts.length)}
            </span>
          </div>
          {visibleAlerts.length ? (
            visibleAlerts.map((alert) => (
              <Link
                key={alert.id}
                href={alert.href}
                className={cx(
                  SOFT_CARD_CLASS,
                  'block transition-all hover:-translate-y-0.5 hover:bg-zinc-100 dark:hover:bg-white/10'
                )}
              >
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {alert.message}
                </p>
              </Link>
            ))
          ) : (
            <div className={EMPTY_STATE_CLASS}>
              No urgent leadership alerts need action right now.
            </div>
          )}
          {alerts.length > visibleAlerts.length ? (
            <p className="px-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              +{formatNumber(alerts.length - visibleAlerts.length)} more alerts are available in the watchlist.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function OperationalWatchlistSection({
  metrics,
  alerts,
  actionGroups,
  }: {
    metrics: {
      blockedEditions: number;
      qualityAlerts: number;
      inboxEscalations: number;
      queueBacklog: number;
      reportingAlerts: number;
    };
    alerts: SuperAdminAlert[];
    actionGroups: SuperAdminActionGroup[];
  }) {
  const groupedAlerts = {
    critical: alerts.filter((alert) => alert.severity === 'critical'),
    warning: alerts.filter((alert) => alert.severity === 'warning'),
    info: alerts.filter((alert) => alert.severity === 'info'),
  };

  const severityCards: Array<{
    key: SuperAdminAlert['severity'];
    value: number;
  }> = [
    { key: 'critical', value: groupedAlerts.critical.length },
    { key: 'warning', value: groupedAlerts.warning.length },
    { key: 'info', value: groupedAlerts.info.length },
  ];

  return (
    <section className={PANEL_CLASS}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-orange-600" />
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Operational Watchlist
        </h2>
      </div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        Leadership-facing risks grouped by urgency, with direct action paths for the desk.
      </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className={METRIC_CARD_CLASS}>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Blocked Editions
          </p>
          <p className="mt-2 text-2xl font-black text-zinc-900 dark:text-zinc-100">
            {formatNumber(metrics.blockedEditions)}
          </p>
        </div>
        <div className={METRIC_CARD_CLASS}>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Quality Alerts
          </p>
          <p className="mt-2 text-2xl font-black text-zinc-900 dark:text-zinc-100">
            {formatNumber(metrics.qualityAlerts)}
          </p>
        </div>
        <div className={METRIC_CARD_CLASS}>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Inbox Escalations
          </p>
          <p className="mt-2 text-2xl font-black text-zinc-900 dark:text-zinc-100">
            {formatNumber(metrics.inboxEscalations)}
          </p>
        </div>
          <div className={METRIC_CARD_CLASS}>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Queue Backlog
            </p>
            <p className="mt-2 text-2xl font-black text-zinc-900 dark:text-zinc-100">
              {formatNumber(metrics.queueBacklog)}
            </p>
          </div>
          <div className={METRIC_CARD_CLASS}>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Reporting Alerts
            </p>
            <p className="mt-2 text-2xl font-black text-zinc-900 dark:text-zinc-100">
              {formatNumber(metrics.reportingAlerts)}
            </p>
          </div>
        </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {severityCards.map((card) => (
          <div
            key={card.key}
            className={`rounded-[22px] border p-4 ${getSeverityToneClass(card.key)}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide">
              {formatSeverityLabel(card.key)} Alerts
            </p>
            <p className="mt-2 text-2xl font-black">{formatNumber(card.value)}</p>
          </div>
        ))}
      </div>

      {actionGroups.length ? (
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          {actionGroups.map((group) => (
            <Link
              key={group.id}
              href={group.href}
              className={cx(
                SOFT_CARD_CLASS,
                'transition-all hover:-translate-y-0.5 hover:bg-zinc-100 dark:hover:bg-white/10'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {group.title}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {group.description}
                  </p>
                </div>
                <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                  {formatNumber(group.count)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {severityCards.map((card) =>
          card.value > 0 ? (
            <div key={`group-${card.key}`}>
              <div className="mb-3 flex items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${getSeverityToneClass(card.key)}`}
                >
                  {formatSeverityLabel(card.key)}
                </span>
              </div>
              <div className="space-y-3">
                {groupedAlerts[card.key].slice(0, 3).map((alert) => (
                  <Link
                    key={alert.id}
                    href={alert.href}
                  className={cx(
                    SOFT_CARD_CLASS,
                    'block transition-all hover:-translate-y-0.5 hover:bg-zinc-100 dark:hover:bg-white/10'
                  )}
                  >
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {alert.message}
                    </p>
                  </Link>
                ))}
              </div>
              {groupedAlerts[card.key].length > 3 ? (
                <p className="mt-2 px-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  +{formatNumber(groupedAlerts[card.key].length - 3)} more {formatSeverityLabel(card.key).toLowerCase()} alerts are hidden here.
                </p>
              ) : null}
            </div>
          ) : null
        )}

        {!alerts.length ? (
          <div className={EMPTY_STATE_CLASS}>
            No leadership alerts need action right now.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function getGrowthToneClass(tone: SuperAdminGrowthHighlight['tone']) {
  switch (tone) {
    case 'critical':
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300';
    case 'watch':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
    case 'good':
    default:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
  }
}

function GrowthHighlightsSection({ items }: { items: SuperAdminGrowthHighlight[] }) {
  return (
    <section className={PANEL_CLASS}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Growth Highlights
            </h2>
          </div>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            The strongest section, channel, and audience-path movement from the last 30 days.
          </p>
        </div>
        <Link href="/admin/analytics?tab=growth&focus=all&content=all&range=30d&compare=previous" className={SECTION_LINK_CLASS}>
          Open Growth Watch
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {items.length ? (
          items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`rounded-[24px] border p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:opacity-95 ${getGrowthToneClass(item.tone)}`}
            >
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-2 text-sm leading-6 opacity-90">{item.detail}</p>
            </Link>
          ))
        ) : (
          <div className={cx(EMPTY_STATE_CLASS, 'xl:col-span-2')}>
            Growth highlights will appear once audience and compare-period data has enough history.
          </div>
        )}
      </div>
    </section>
  );
}

function QualityWatchlistSection({
  items,
  className,
}: {
  items: Array<{
    epaperId: string;
    pageNumber: number;
    epaperTitle: string;
    cityName: string;
    issueSummary: string;
    qualityLabel: string;
    editHref: string;
  }>;
  className?: string;
}) {
  const visibleItems = items.slice(0, 4);

  return (
    <section className={cx(PANEL_CLASS, className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Quality Watchlist</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Pages that still need hotspot, OCR, or QA cleanup before the edition feels release-ready.
          </p>
        </div>
        <Link href="/admin/review-queue" className={SECTION_LINK_CLASS}>
          Open Overview
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {visibleItems.length > 0 ? (
          visibleItems.map((page) => (
            <Link
              key={`${page.epaperId}-${page.pageNumber}`}
              href={page.editHref}
              className={cx(
                SOFT_CARD_CLASS,
                'block transition-all hover:-translate-y-0.5 hover:bg-zinc-100 dark:hover:bg-white/10'
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {page.epaperTitle} / Page {page.pageNumber}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {page.cityName} / {page.issueSummary}
                  </p>
                </div>
                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">
                  {page.qualityLabel}
                </span>
              </div>
            </Link>
          ))
        ) : (
          <div className={EMPTY_STATE_CLASS}>
            No active page-quality alerts right now.
          </div>
        )}
        {items.length > visibleItems.length ? (
          <p className="px-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            +{formatNumber(items.length - visibleItems.length)} more quality issues are available in the review queue.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function getQuickActions(role: string): QuickAction[] {
  switch (role) {
    case 'reporter':
      return [
        {
          label: 'Start Story',
          description: 'Create a new story draft and send it into review.',
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
          label: 'Stories',
          description: 'Open your stories desk view.',
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
  const reviewQueue = superAdminDashboard?.reviewQueue ?? baseReviewQueue;
  const epaperInsights = superAdminDashboard?.epaperInsights ?? null;
  const teamHealth = superAdminDashboard?.teamHealth ?? null;
  const quickActions = getQuickActions(admin.role);
  const myItems = myWork?.items || [];
  const reviewItems = reviewQueue?.items || [];
  const superAdminMetrics = superAdminDashboard?.metrics || null;
  const decisionCenterItems = superAdminDashboard?.readyDecisionItems || [];
  const superAdminOverviewItems = superAdminDashboard?.newsroomOverviewItems || reviewItems.slice(0, 8);
  const qualityWatchlist = superAdminDashboard?.qualityWatchlist || epaperInsights?.lowQualityPages || [];
  const blockedEditionItems = superAdminDashboard?.blockedEditionItems || [];
  const actionGroups = superAdminDashboard?.actionGroups || [];
  const growthHighlights = superAdminDashboard?.growthHighlights || [];
  const myAssignedDeskCount =
    Number(myWork?.counts.assigned || 0) +
    Number(myWork?.counts.in_review || 0) +
    Number(myWork?.counts.copy_edit || 0) +
    Number(myWork?.productionCounts.pages_ready || 0) +
    Number(myWork?.productionCounts.ocr_review || 0) +
    Number(myWork?.productionCounts.hotspot_mapping || 0) +
    Number(myWork?.productionCounts.qa_review || 0) +
    Number(myWork?.productionCounts.ready_to_publish || 0);
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
            label: 'Assigned To Me',
            value: myAssignedDeskCount,
            note: 'Workflow items actively sitting with you right now.',
            icon: CheckCircle2,
            tone: 'bg-amber-500/15 text-amber-600',
          },
          {
            label: 'Published',
            value: Number(myWork?.counts.published || 0),
            note: 'Your articles already live to readers.',
            icon: Newspaper,
            tone: 'bg-emerald-500/15 text-emerald-600',
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
              value: myAssignedDeskCount,
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
    <div className={cx('space-y-6', admin.role === 'super_admin' && 'mx-auto max-w-[1580px] space-y-8')}>
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
                <h1 className="mt-2 text-3xl font-black text-zinc-900 dark:text-zinc-100">
                  Newsroom Dashboard
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  {isReporterDeskRole(admin.role)
                    ? 'See your drafts, submissions, and assigned article work first.'
                    : admin.role === 'copy_editor'
                      ? 'See the editorial queue, your copy desk workload, and e-paper production pressure first.'
                      : admin.role === 'admin'
                        ? 'See queue pressure, publish-ready work, edition production, inbox load, and editorial operations first.'
                        : 'See newsroom output and live workflow pressure at a glance.'}
                </p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((action) => (
              <QuickActionCard key={action.href} action={action} />
            ))}
          </section>
        </>
      )}

      <section
        className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${
          admin.role === 'super_admin' ? 'xl:grid-cols-6' : 'xl:grid-cols-4'
        }`}
      >
        {statCards.map((stat) =>
          admin.role === 'super_admin' ? (
            <LeadershipStatCard key={stat.label} stat={stat} />
          ) : (
            <StatCard key={stat.label} stat={stat} />
          )
        )}
      </section>

      {newsroomPipeline && (admin.role === 'admin' || admin.role === 'super_admin') ? (
        <NewsroomPipelineSection analytics={newsroomPipeline} />
      ) : null}

      {isReporterDeskRole(admin.role) ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <WorkflowListSection
            title="My Desk Items"
            description="The items currently owned by you or assigned to your reporting queue."
            href="/admin/my-work"
            linkLabel="Open My Work"
            items={myItems}
            emptyMessage="No owned or assigned workflow items yet. New drafts and submissions will appear here."
          />
          <section className={PANEL_CLASS}>
            <h2 className="text-xl font-bold text-[var(--admin-shell-text)]">Newsroom Pulse</h2>
            <p className="mt-1 text-sm text-[var(--admin-shell-text-muted)]">
              Global article flow so you can see how the desk is moving overall.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className={METRIC_CARD_CLASS}>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-shell-text-muted)]">
                  Needs Review
                </p>
                <p className="mt-2 text-2xl font-bold text-[var(--admin-shell-text)]">
                  {formatNumber(dashboard.workflow.needsReview)}
                </p>
              </div>
              <div className={METRIC_CARD_CLASS}>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-shell-text-muted)]">
                  Ready To Publish
                </p>
                <p className="mt-2 text-2xl font-bold text-[var(--admin-shell-text)]">
                  {formatNumber(dashboard.workflow.readyToPublish + readyEditionCount)}
                </p>
              </div>
              <div className={METRIC_CARD_CLASS}>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-shell-text-muted)]">
                  Published
                </p>
                <p className="mt-2 text-2xl font-bold text-[var(--admin-shell-text)]">
                  {formatNumber(dashboard.workflow.published)}
                </p>
              </div>
              <div className={METRIC_CARD_CLASS}>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-shell-text-muted)]">
                  Rejected
                </p>
                <p className="mt-2 text-2xl font-bold text-[var(--admin-shell-text)]">
                  {formatNumber(dashboard.workflow.rejected)}
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
            description="Submitted content and production-stage editions needing copy and quality handling."
            href="/admin/copy-desk"
            linkLabel="Open Copy Desk"
            items={activeReviewItems}
            emptyMessage="No live review items are waiting right now."
          />
          <WorkflowListSection
            title="My Desk"
            description="Items currently assigned to you or created from your desk."
            href="/admin/my-work"
            linkLabel="Open My Work"
            items={myItems}
            emptyMessage="No current desk items are assigned to you yet."
          />
        </div>
      ) : null}

      {admin.role === 'admin' ? (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr,1fr]">
            <div className="space-y-6">
              <WorkflowListSection
                title="Ready To Publish"
                description="Approved content and ready editions waiting for release decisions."
                href="/admin/content-queue"
                linkLabel="Open Content Queue"
                items={readyToPublishItems}
                emptyMessage="No content or editions are waiting for publish decisions right now."
              />
              <WorkflowListSection
                title="Live Review Queue"
                description="Current queue pressure still moving through editorial and production workflow."
                href="/admin/assignments"
                linkLabel="Open Assignments"
                items={activeReviewItems}
                emptyMessage="The live review queue is clear right now."
              />
            </div>
            <InboxSnapshot counts={dashboard.inbox} />
          </div>

          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1.18fr,0.95fr,0.9fr]">
            <div className="space-y-6">
              <DecisionCenterSection
                readyDecisionItems={decisionCenterItems}
                blockedEditionItems={blockedEditionItems}
                alerts={leadershipAlerts}
              />
              <WorkflowListSection
                title="Newsroom Overview"
                description="High-level queue pressure across content workflow and edition production."
                href="/admin/review-queue"
                linkLabel="Open Newsroom Overview"
                items={superAdminOverviewItems}
                emptyMessage="No live workflow items are waiting in the newsroom right now."
              />
            </div>

            <div className="space-y-6">
              <OperationalWatchlistSection
                metrics={{
                  blockedEditions: superAdminMetrics?.blockedEditions || 0,
                  qualityAlerts: superAdminMetrics?.qualityAlerts || 0,
                  inboxEscalations: superAdminMetrics?.inboxEscalations || dashboard.inbox.new,
                  queueBacklog:
                    superAdminMetrics?.queueBacklog ||
                    dashboard.workflow.needsReview + activeEditionCount,
                  reportingAlerts: superAdminMetrics?.reportingAlerts || 0,
                }}
                alerts={leadershipAlerts}
                actionGroups={actionGroups}
              />
              <GrowthHighlightsSection items={growthHighlights} />
            </div>

            <div className="space-y-6">
              <QualityWatchlistSection items={qualityWatchlist} />
            </div>
          </div>
        </>
      ) : null}

      {admin.role === 'super_admin' ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr,1fr]">
          <TeamHealthSection summary={teamHealth} />
          <InboxSnapshot counts={dashboard.inbox} />
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
