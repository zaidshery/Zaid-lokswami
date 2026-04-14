import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  FileText,
  Globe2,
  Layers3,
  MessageSquareMore,
  Newspaper,
  TimerReset,
  TrendingUp,
  UserCog,
  Video,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  type AnalyticsCenterData,
  type AnalyticsCompareMode,
  type AnalyticsDateRange,
  getAnalyticsCenterData,
} from '@/lib/admin/analyticsCenter';
import { buildBusinessGrowthInsights } from '@/lib/admin/businessGrowthInsights';
import {
  getLeadershipReportPresetCollection,
  type LeadershipReport,
} from '@/lib/admin/leadershipReports';
import { buildAnalyticsLiveChartsSnapshot } from '@/lib/admin/analyticsLiveCharts';
import {
  buildLeadershipReportEscalations,
  buildLeadershipReportHealthAlerts,
  getLeadershipReportRuntimeSnapshot,
} from '@/lib/admin/leadershipReportHealth';
import { getLeadershipReportCriticalAlertState } from '@/lib/storage/leadershipReportCriticalAlertStateFile';
import { listLeadershipReportRunHistory } from '@/lib/storage/leadershipReportRunHistoryFile';
import { listLeadershipReportAlertNotificationHistory } from '@/lib/storage/leadershipReportAlertNotificationHistoryFile';
import type { WorkflowArticleCard } from '@/lib/admin/articleWorkflowOverview';
import { getAdminSession } from '@/lib/auth/admin';
import { canViewPage } from '@/lib/auth/permissions';
import { formatUserRoleLabel } from '@/lib/auth/roles';
import { listLeadershipReportSchedules } from '@/lib/storage/leadershipReportSchedulesFile';
import { formatUiDate } from '@/lib/utils/dateFormat';
import formatNumber from '@/lib/utils/formatNumber';
import AnalyticsLiveCharts from './AnalyticsLiveCharts';
import AnalyticsShareActions from './AnalyticsShareActions';
import LeadershipReportDeliveryPanel from './LeadershipReportDeliveryPanel';
import LeadershipReportActions from './LeadershipReportActions';

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

type AnalyticsTab =
  | 'overview'
  | 'audience'
  | 'newsroom_ops'
  | 'epaper_ops'
  | 'team'
  | 'content'
  | 'growth'
  | 'system_health';
type AnalyticsFocus = 'all' | 'review' | 'ready' | 'blocked' | 'quality';
type AnalyticsContentFilter = 'all' | 'article' | 'story' | 'video' | 'epaper';

type AnalyticsMetricCard = {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  tone: string;
};

type AnalyticsTrendCard = {
  label: string;
  currentValue: number;
  previousValue: number | null;
  delta: number | null;
  detail: string;
  icon: LucideIcon;
  tone: string;
  preference: 'higher_better' | 'lower_better';
};

type AnalyticsViewPreset = {
  id: string;
  label: string;
  description: string;
  tab: AnalyticsTab;
  focus: AnalyticsFocus;
  content: AnalyticsContentFilter;
  range: AnalyticsDateRange;
  compare: AnalyticsCompareMode;
};

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ');
}

const ANALYTICS_PANEL_CLASS = 'admin-shell-surface-strong rounded-[32px] p-6';

const ANALYTICS_SOFT_CARD_CLASS =
  'admin-shell-surface-muted rounded-[24px] p-4 shadow-[0_18px_48px_-40px_rgba(15,23,42,0.12)] dark:shadow-[0_18px_48px_-40px_rgba(0,0,0,0.35)]';

const ANALYTICS_EMPTY_STATE_CLASS =
  'rounded-[24px] border border-dashed border-[color:var(--admin-shell-border-strong)] bg-[color:var(--admin-shell-surface-muted)] p-4 text-sm leading-6 text-[color:var(--admin-shell-text-muted)]';

const ANALYTICS_META_CHIP_CLASS =
  'admin-shell-surface inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-shell-text-muted)]';

const ANALYTICS_LINK_CLASS =
  'admin-shell-toolbar-btn inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-shell-text)] transition-colors hover:text-[color:var(--admin-shell-accent)]';

const ANALYTICS_TABS: Array<{
  id: AnalyticsTab;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  { id: 'overview', label: 'Overview', description: 'Leadership snapshot', icon: BarChart3 },
  { id: 'audience', label: 'Audience', description: 'Reader activity and engagement', icon: Globe2 },
  { id: 'newsroom_ops', label: 'Newsroom Ops', description: 'Queue and release flow', icon: TimerReset },
  { id: 'epaper_ops', label: 'E-Paper Ops', description: 'Quality and blockers', icon: Newspaper },
  { id: 'team', label: 'Team', description: 'Coverage and sign-ins', icon: UserCog },
  { id: 'content', label: 'Content', description: 'Inventory and top output', icon: Layers3 },
  { id: 'growth', label: 'Growth', description: 'Momentum, opportunities, and path performance', icon: TrendingUp },
  { id: 'system_health', label: 'System Health', description: 'Runtime and risk signals', icon: AlertTriangle },
];

const FOCUS_OPTIONS: Array<{ id: AnalyticsFocus; label: string }> = [
  { id: 'all', label: 'All Signals' },
  { id: 'review', label: 'Review Flow' },
  { id: 'ready', label: 'Ready Decisions' },
  { id: 'blocked', label: 'Blocked Editions' },
  { id: 'quality', label: 'Quality Alerts' },
];

const CONTENT_FILTER_OPTIONS: Array<{ id: AnalyticsContentFilter; label: string }> = [
  { id: 'all', label: 'All Content' },
  { id: 'article', label: 'Articles' },
  { id: 'story', label: 'Stories' },
  { id: 'video', label: 'Videos' },
  { id: 'epaper', label: 'E-Papers' },
];

const RANGE_OPTIONS: Array<{ id: AnalyticsDateRange; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: '90d', label: 'Last 90 Days' },
];

const COMPARE_OPTIONS: Array<{ id: AnalyticsCompareMode; label: string }> = [
  { id: 'off', label: 'No Compare' },
  { id: 'previous', label: 'Previous Period' },
];

const ANALYTICS_VIEW_PRESETS: AnalyticsViewPreset[] = [
  {
    id: 'leadership_overview',
    label: 'Leadership Overview',
    description: 'Full leadership snapshot with previous-period comparison.',
    tab: 'overview',
    focus: 'all',
    content: 'all',
    range: '30d',
    compare: 'previous',
  },
  {
    id: 'audience_activity',
    label: 'Audience Activity',
    description: 'Reader-side engagement, sources, and conversion signals.',
    tab: 'audience',
    focus: 'all',
    content: 'all',
    range: '30d',
    compare: 'previous',
  },
  {
    id: 'release_watch',
    label: 'Release Watch',
    description: 'Ready decisions and active desk flow over the last 7 days.',
    tab: 'newsroom_ops',
    focus: 'ready',
    content: 'all',
    range: '7d',
    compare: 'previous',
  },
  {
    id: 'edition_risk',
    label: 'Edition Risk',
    description: 'Blocked editions and quality issues across the e-paper desk.',
    tab: 'epaper_ops',
    focus: 'quality',
    content: 'epaper',
    range: '30d',
    compare: 'previous',
  },
  {
    id: 'team_coverage',
    label: 'Team Coverage',
    description: 'Admin-side sign-ins, coverage, and access alerts.',
    tab: 'team',
    focus: 'all',
    content: 'all',
    range: '30d',
    compare: 'previous',
  },
  {
    id: 'content_health',
    label: 'Content Health',
    description: 'Inventory and article-led content snapshot for the desk.',
    tab: 'content',
    focus: 'all',
    content: 'article',
    range: '30d',
    compare: 'off',
  },
  {
    id: 'growth_watch',
    label: 'Growth Watch',
    description: 'Section, channel, and audience-path growth signals with compare-period context.',
    tab: 'growth',
    focus: 'all',
    content: 'all',
    range: '30d',
    compare: 'previous',
  },
  {
    id: 'system_watch',
    label: 'System Watch',
    description: 'Service readiness, runtime signals, and platform risks.',
    tab: 'system_health',
    focus: 'all',
    content: 'all',
    range: '30d',
    compare: 'off',
  },
];

const SUPER_ADMIN_PRIMARY_TABS: AnalyticsTab[] = [
  'overview',
  'newsroom_ops',
  'growth',
  'system_health',
];

const SUPER_ADMIN_QUICK_VIEW_PRESETS = [
  'leadership_overview',
  'release_watch',
  'growth_watch',
  'system_watch',
] as const;

function readSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : null;
  }

  return typeof value === 'string' ? value : null;
}

function parseTab(value: string | null): AnalyticsTab {
  return ANALYTICS_TABS.some((tab) => tab.id === value) ? (value as AnalyticsTab) : 'overview';
}

function parseFocus(value: string | null): AnalyticsFocus {
  return FOCUS_OPTIONS.some((option) => option.id === value)
    ? (value as AnalyticsFocus)
    : 'all';
}

function parseContentFilter(value: string | null): AnalyticsContentFilter {
  return CONTENT_FILTER_OPTIONS.some((option) => option.id === value)
    ? (value as AnalyticsContentFilter)
    : 'all';
}

function parseRange(value: string | null): AnalyticsDateRange {
  return RANGE_OPTIONS.some((option) => option.id === value)
    ? (value as AnalyticsDateRange)
    : '30d';
}

function parseCompare(value: string | null): AnalyticsCompareMode {
  return COMPARE_OPTIONS.some((option) => option.id === value)
    ? (value as AnalyticsCompareMode)
    : 'off';
}

function buildAnalyticsHref(
  params: Record<string, string | string[] | undefined>,
  patch: Partial<{
    tab: AnalyticsTab;
    focus: AnalyticsFocus;
    content: AnalyticsContentFilter;
    range: AnalyticsDateRange;
    compare: AnalyticsCompareMode;
  }>
) {
  const next = new URLSearchParams();
  const tab = patch.tab ?? parseTab(readSearchParam(params.tab));
  const focus = patch.focus ?? parseFocus(readSearchParam(params.focus));
  const content = patch.content ?? parseContentFilter(readSearchParam(params.content));
  const range = patch.range ?? parseRange(readSearchParam(params.range));
  const compare = patch.compare ?? parseCompare(readSearchParam(params.compare));

  next.set('tab', tab);
  next.set('focus', focus);
  next.set('content', content);
  next.set('range', range);
  next.set('compare', compare);

  return `/admin/analytics?${next.toString()}`;
}

function buildAnalyticsExportHref(params: Record<string, string | string[] | undefined>) {
  const next = new URLSearchParams();

  next.set('tab', parseTab(readSearchParam(params.tab)));
  next.set('focus', parseFocus(readSearchParam(params.focus)));
  next.set('content', parseContentFilter(readSearchParam(params.content)));
  next.set('range', parseRange(readSearchParam(params.range)));
  next.set('compare', parseCompare(readSearchParam(params.compare)));

  return `/api/admin/analytics/export?${next.toString()}`;
}

function buildAnalyticsPresetHref(preset: AnalyticsViewPreset) {
  return `/admin/analytics?${new URLSearchParams({
    tab: preset.tab,
    focus: preset.focus,
    content: preset.content,
    range: preset.range,
    compare: preset.compare,
  }).toString()}`;
}

function formatSourceLabel(source: 'mongodb' | 'file' | 'hybrid') {
  switch (source) {
    case 'mongodb':
      return 'MongoDB live data';
    case 'file':
      return 'Local file store';
    case 'hybrid':
    default:
      return 'MongoDB + file-store fallback';
  }
}

function formatContentTypeLabel(contentType: string) {
  return contentType === 'epaper'
    ? 'E-Paper'
    : contentType.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
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

function isReadyWorkflowStatus(status: string) {
  return (
    status === 'ready_for_approval' ||
    status === 'approved' ||
    status === 'scheduled' ||
    status === 'ready_to_publish'
  );
}

function matchesContentFilter(item: WorkflowArticleCard, contentFilter: AnalyticsContentFilter) {
  return contentFilter === 'all' || item.contentType === contentFilter;
}

function matchesNewsroomFocus(item: WorkflowArticleCard, focus: AnalyticsFocus) {
  if (focus === 'ready') {
    return isReadyWorkflowStatus(item.status);
  }

  if (focus === 'review') {
    return !isReadyWorkflowStatus(item.status);
  }

  return true;
}

function countItemsByStatuses(items: WorkflowArticleCard[], statuses: string[]) {
  return items.filter((item) => statuses.includes(item.status)).length;
}

function countQualityPagesByLabel(
  pages: Array<{ qualityLabel: string }>,
  qualityLabel: string
) {
  return pages.filter((page) => page.qualityLabel === qualityLabel).length;
}

function countQualityPagesByReviewStatus(
  pages: Array<{ reviewStatus: string }>,
  reviewStatus: string
) {
  return pages.filter((page) => page.reviewStatus === reviewStatus).length;
}

function formatDelta(value: number) {
  return value > 0 ? `+${formatNumber(value)}` : formatNumber(value);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toFixed(rounded % 1 === 0 ? 0 : 1)}%`;
}

function matchesPreset(
  preset: AnalyticsViewPreset,
  activeFilters: {
    tab: AnalyticsTab;
    focus: AnalyticsFocus;
    content: AnalyticsContentFilter;
    range: AnalyticsDateRange;
    compare: AnalyticsCompareMode;
  }
) {
  return (
    preset.tab === activeFilters.tab &&
    preset.focus === activeFilters.focus &&
    preset.content === activeFilters.content &&
    preset.range === activeFilters.range &&
    preset.compare === activeFilters.compare
  );
}

function getDeltaToneClass(value: number, preference: 'higher_better' | 'lower_better') {
  if (value === 0) {
    return 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';
  }

  const isPositive = value > 0;
  const isGood =
    (preference === 'higher_better' && isPositive) ||
    (preference === 'lower_better' && !isPositive);

  return isGood
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300';
}

function getLeadershipMetricToneClass(tone: LeadershipReport['metrics'][number]['tone']) {
  switch (tone) {
    case 'good':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
    case 'watch':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
    case 'critical':
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300';
    case 'neutral':
    default:
      return 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';
  }
}

function getLeadershipGrowthToneClass(
  tone:
    | NonNullable<LeadershipReport['growthHighlights']>[number]['tone']
    | NonNullable<LeadershipReport['growthOpportunities']>[number]['tone']
) {
  switch (tone) {
    case 'good':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
    case 'watch':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
    case 'critical':
    default:
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300';
  }
}

function TabLink({
  href,
  label,
  description,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-[24px] border p-4 shadow-sm transition-all hover:-translate-y-0.5 ${
        active
          ? 'border-[color:var(--admin-shell-active)] bg-[color:var(--admin-shell-active)] text-[color:var(--admin-shell-active-text)] shadow-[var(--admin-shell-shadow-strong)]'
          : 'border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface)] text-[color:var(--admin-shell-text)] hover:bg-[color:var(--admin-shell-surface-muted)]'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`rounded-xl p-2 ${
            active
              ? 'bg-white/15 dark:bg-black/20'
              : 'bg-[color:var(--admin-shell-surface-muted)]'
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p
            className={`mt-1 text-xs ${
              active ? 'text-white/80 dark:text-black/60' : 'text-[color:var(--admin-shell-text-muted)]'
            }`}
          >
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}

function PresetLink({
  href,
  label,
  description,
  active,
}: {
  href: string;
  label: string;
  description: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-[24px] border p-4 shadow-sm transition-all hover:-translate-y-0.5 ${
        active
          ? 'border-red-200 bg-red-50 text-red-700 shadow-[0_18px_40px_-24px_rgba(220,38,38,0.25)] dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300'
          : 'border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface)] text-[color:var(--admin-shell-text)] hover:bg-[color:var(--admin-shell-surface-muted)]'
      }`}
    >
      <p className="text-sm font-semibold">{label}</p>
      <p
        className={`mt-2 text-xs leading-5 ${
          active ? 'text-red-600/90 dark:text-red-300/90' : 'text-[color:var(--admin-shell-text-muted)]'
        }`}
      >
        {description}
      </p>
    </Link>
  );
}

function AnalyticsHeroSection({
  roleLabel,
  sourceLabel,
  activeTab,
  rangeLabel,
  compareLabel,
}: {
  roleLabel: string;
  sourceLabel: string;
  activeTab: string;
  rangeLabel: string;
  compareLabel: string;
}) {
  const summaryChips = [
    { label: 'Active View', value: activeTab },
    { label: 'Window', value: rangeLabel },
    { label: 'Compare', value: compareLabel },
    { label: 'Source', value: sourceLabel },
  ];

  return (
    <section className="relative overflow-hidden rounded-[36px] border border-[color:var(--admin-shell-border)] bg-[radial-gradient(circle_at_top_left,rgba(185,28,28,0.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.08),transparent_28%),var(--admin-bg-depth)] p-8 text-[color:var(--admin-shell-text)] shadow-[var(--admin-shell-shadow-strong)] lg:p-10">
      <div className="pointer-events-none absolute -right-10 top-0 h-48 w-48 rounded-full bg-blue-500/12 blur-3xl dark:bg-blue-500/14" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full bg-red-500/10 blur-3xl dark:bg-red-500/14" />
      <div className="relative grid gap-8 xl:grid-cols-[1.3fr,0.8fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
            {roleLabel}
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-[color:var(--admin-shell-text)] sm:text-5xl">
            Analytics Command Center
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[color:var(--admin-shell-text-muted)] sm:text-[15px]">
            A cleaner leadership surface for newsroom operations, audience growth, delivery health,
            quality pressure, and system risk across the admin platform.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {summaryChips.map((chip) => (
              <div
                key={chip.label}
                className={cx(ANALYTICS_META_CHIP_CLASS, 'rounded-2xl px-4 py-3 shadow-sm')}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--admin-shell-text-muted)]">
                  {chip.label}
                </p>
                <p className="mt-1 text-lg font-black text-[color:var(--admin-shell-text)]">
                  {chip.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="admin-shell-surface rounded-[28px] p-5 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-600 dark:text-blue-300">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-shell-text-muted)]">
                  How Leadership Uses This Page
                </p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--admin-shell-text)]">
                  One place for growth, quality, delivery, and runtime signals.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div
                className={cx(
                  ANALYTICS_SOFT_CARD_CLASS,
                  'text-sm leading-6 text-[color:var(--admin-shell-text)]'
                )}
              >
                Switch between operations, audience, growth, and system views without leaving the analytics surface.
              </div>
              <div
                className={cx(
                  ANALYTICS_SOFT_CARD_CLASS,
                  'text-sm leading-6 text-[color:var(--admin-shell-text)]'
                )}
              >
                Save views, compare periods, export reports, and manage leadership delivery from one cleaner control layer.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LeadershipReportCard({ report }: { report: LeadershipReport }) {
  return (
    <section className={ANALYTICS_PANEL_CLASS}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">
            {report.cadenceLabel}
          </p>
          <h3 className="mt-2 text-xl font-black text-zinc-900 dark:text-zinc-100">
            {report.label}
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            {report.description}
          </p>
          <p className="mt-3 text-sm font-medium text-zinc-800 dark:text-zinc-100">
            {report.headline}
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            {report.summary}
          </p>
        </div>
        <LeadershipReportActions
          viewHref={report.viewHref}
          downloadHref={report.downloadHref}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {report.metrics.slice(0, 6).map((metric) => (
          <div
            key={`${report.id}-${metric.label}`}
            className={`rounded-[24px] border p-4 ${getLeadershipMetricToneClass(metric.tone)}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide">{metric.label}</p>
            <p className="mt-2 text-2xl font-black">{formatNumber(metric.value)}</p>
            <p className="mt-2 text-sm opacity-90">{metric.detail}</p>
          </div>
        ))}
      </div>

      <div className={cx('mt-6', ANALYTICS_SOFT_CARD_CLASS)}>
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Growth Snapshot
          </h4>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Section, channel, and path momentum
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {report.growthHighlights?.length ? (
            report.growthHighlights.map((item) => (
              <div
                key={`${report.id}-${item.title}`}
                className={`rounded-[22px] border px-3 py-3 text-sm ${getLeadershipGrowthToneClass(item.tone)}`}
              >
                <p className="font-semibold">{item.title}</p>
                <p className="mt-2 opacity-90">{item.detail}</p>
              </div>
            ))
          ) : (
            <p className={cx(ANALYTICS_EMPTY_STATE_CLASS, 'xl:col-span-2')}>
              No growth snapshot signals were generated for this report.
            </p>
          )}
        </div>
      </div>

      {report.growthOpportunities?.length ? (
        <div className={cx('mt-6', ANALYTICS_SOFT_CARD_CLASS)}>
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Growth Opportunities
            </h4>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Best business upside to improve next
            </span>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
            {report.growthOpportunities.map((item) => (
              <div
                key={`${report.id}-${item.title}`}
                className={`rounded-[22px] border px-3 py-3 text-sm ${getLeadershipGrowthToneClass(item.tone)}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{item.title}</p>
                  <span className="rounded-full border border-current/20 px-2.5 py-1 text-[11px] font-semibold">
                    Score {formatNumber(item.score)}
                  </span>
                </div>
                <p className="mt-2 opacity-90">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr,1fr]">
        <div className={ANALYTICS_SOFT_CARD_CLASS}>
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Positive Signals
            </h4>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Generated {formatUiDate(report.generatedAt, report.generatedAt)}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {report.wins.length ? (
              report.wins.map((win) => (
                <p
                  key={`${report.id}-${win}`}
                  className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                >
                  {win}
                </p>
              ))
            ) : (
              <p className={ANALYTICS_EMPTY_STATE_CLASS}>
                No standout positive signals were generated for this report.
              </p>
            )}
          </div>
        </div>

        <div className={ANALYTICS_SOFT_CARD_CLASS}>
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Leadership Risks & Actions
          </h4>
          <div className="mt-3 space-y-2">
            {report.risks.length ? (
              report.risks.map((risk) => (
                <p
                  key={`${report.id}-${risk}`}
                  className="rounded-[22px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
                >
                  {risk}
                </p>
              ))
            ) : (
              <p className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                No major leadership risks are active in this reporting window.
              </p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {report.actions.map((action) => (
              <Link
                key={`${report.id}-${action.label}`}
                href={action.href}
                className={`inline-flex items-center justify-center rounded-2xl border px-3 py-2 text-sm font-semibold transition-colors ${
                  action.tone === 'primary'
                    ? 'border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200'
                    : action.tone === 'warning'
                      ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20'
                      : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800'
                }`}
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
        active
          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300'
          : 'border-zinc-200/80 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-200 dark:hover:bg-white/8'
      }`}
    >
      {label}
    </Link>
  );
}

function MetricCard({ metric }: { metric: AnalyticsMetricCard }) {
  return (
    <div className="group relative overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white/92 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.42)] backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-[0_28px_80px_-40px_rgba(15,23,42,0.5)] dark:border-white/10 dark:bg-zinc-950/60">
      <div className={cx('pointer-events-none absolute -right-5 -top-5 h-24 w-24 rounded-full opacity-20 blur-2xl', metric.tone)} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{metric.label}</p>
          <p className="mt-4 text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
            {formatNumber(metric.value)}
          </p>
        </div>
        <div className={`rounded-2xl p-3 ring-1 ring-black/5 dark:ring-white/10 ${metric.tone}`}>
          <metric.icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{metric.detail}</p>
    </div>
  );
}

function GrowthAnalyticsSections({
  analytics,
  compare,
  growthInsights,
  isCompact,
}: {
  analytics: AnalyticsCenterData;
  compare: AnalyticsCompareMode;
  growthInsights: ReturnType<typeof buildBusinessGrowthInsights>;
  isCompact?: boolean;
}) {
  return (
    <>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className={ANALYTICS_PANEL_CLASS}>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Growth Leaders</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Sections gaining traffic momentum while still converting readers.
          </p>

          <div className="mt-6 space-y-3">
            {growthInsights.sectionLeaders.length ? (
              growthInsights.sectionLeaders.map((row) => (
                <div
                  key={row.label}
                  className={ANALYTICS_SOFT_CARD_CLASS}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {row.label}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {formatNumber(row.pageViews)} page views / {formatNumber(row.sessions)} sessions
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${getDeltaToneClass(
                        row.momentumDelta,
                        'higher_better'
                      )}`}
                    >
                      {formatDelta(row.momentumDelta)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
                    Conversion {formatPercent(row.conversionRate)} / Delta {formatDelta(row.conversionDelta)} pts
                  </p>
                </div>
              ))
            ) : (
              <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                Growth leaders will appear once section traffic and compare-period history exist.
              </div>
            )}
          </div>
        </section>

        <section className={ANALYTICS_PANEL_CLASS}>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Channel Wins</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Acquisition channels with the strongest momentum and conversion profile.
          </p>

          <div className="mt-6 space-y-3">
            {growthInsights.channelLeaders.length ? (
              growthInsights.channelLeaders.map((row) => (
                <div
                  key={row.label}
                  className={ANALYTICS_SOFT_CARD_CLASS}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {row.label}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {formatNumber(row.events)} events / {formatNumber(row.sessions)} sessions
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${getDeltaToneClass(
                        row.momentumDelta,
                        'higher_better'
                      )}`}
                    >
                      {formatDelta(row.momentumDelta)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
                    Conversion {formatPercent(row.conversionRate)} / Delta {formatDelta(row.conversionDelta)} pts
                  </p>
                </div>
              ))
            ) : (
              <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                Channel winners will appear once acquisition tracking and compare history exist.
              </div>
            )}
          </div>
        </section>

        <section className={ANALYTICS_PANEL_CLASS}>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Growth Watchlist</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            The strongest business-growth signals to lean into or investigate next.
          </p>

          <div className="mt-6 space-y-3">
            {growthInsights.watchlist.length ? (
              growthInsights.watchlist.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-[24px] border p-4 ${getLeadershipMetricToneClass(
                    item.tone === 'good' ? 'good' : item.tone === 'watch' ? 'watch' : 'critical'
                  )}`}
                >
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-2 text-sm opacity-90">{item.detail}</p>
                </div>
              ))
            ) : (
              <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                The watchlist will fill in as path and conversion signals accumulate.
              </div>
            )}
          </div>
        </section>
      </section>

      {isCompact ? null : (
        <>
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className={ANALYTICS_PANEL_CLASS}>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Best Converting Path</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                The audience path converting best across the current reporting window.
              </p>

              <div className="mt-6">
                {growthInsights.bestPath ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                          {growthInsights.bestPath.label}
                        </p>
                        <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-200">
                          {growthInsights.bestPath.channel} / {growthInsights.bestPath.section}
                        </p>
                      </div>
                      <span className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-950 dark:text-emerald-100">
                        {formatPercent(growthInsights.bestPath.overallConversionRate)} conversion
                      </span>
                    </div>
                    <p className="mt-4 text-sm text-emerald-800 dark:text-emerald-100">
                      {growthInsights.bestPath.conversionSessions}/{growthInsights.bestPath.sessions} sessions converted from{' '}
                      {growthInsights.bestPath.device} on {growthInsights.bestPath.pageType}.
                    </p>
                  </div>
                ) : (
                  <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                    Best-path performance will appear once path-level conversion tracking has enough data.
                  </div>
                )}
              </div>
            </section>

            <section className={ANALYTICS_PANEL_CLASS}>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Weakest Converting Path</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                The audience path that is getting traffic but needs the most conversion improvement.
              </p>

              <div className="mt-6">
                {growthInsights.riskPath ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-500/20 dark:bg-red-500/10">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-red-900 dark:text-red-100">
                          {growthInsights.riskPath.label}
                        </p>
                        <p className="mt-1 text-xs text-red-700 dark:text-red-200">
                          {growthInsights.riskPath.channel} / {growthInsights.riskPath.section}
                        </p>
                      </div>
                      <span className="rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 dark:border-red-400/30 dark:bg-red-950 dark:text-red-100">
                        {formatPercent(growthInsights.riskPath.overallConversionRate)} conversion
                      </span>
                    </div>
                    <p className="mt-4 text-sm text-red-800 dark:text-red-100">
                      {growthInsights.riskPath.conversionSessions}/{growthInsights.riskPath.sessions} sessions converted from{' '}
                      {growthInsights.riskPath.device} on {growthInsights.riskPath.pageType}.
                    </p>
                  </div>
                ) : (
                  <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                    Weak-path performance will appear once path-level conversion tracking has enough data.
                  </div>
                )}
              </div>
            </section>
          </section>

          <section className={ANALYTICS_PANEL_CLASS}>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Growth Opportunity Matrix
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  High-reach sections and channels where improving conversion or reversing momentum would create the biggest business upside.
                </p>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Sorted by opportunity score from reach, conversion gap, and trend softening.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
              {growthInsights.opportunities.length ? (
                growthInsights.opportunities.map((item) => (
                  <div
                    key={item.id}
                    className={ANALYTICS_SOFT_CARD_CLASS}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {item.label}
                          </p>
                          <span className={ANALYTICS_META_CHIP_CLASS}>
                            {item.kind}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          Reach {formatNumber(item.reach)} / Sessions {formatNumber(item.sessions)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getLeadershipMetricToneClass(
                            item.tone === 'good' ? 'good' : item.tone === 'watch' ? 'watch' : 'critical'
                          )}`}
                        >
                          {item.tone === 'good' ? 'Opportunity' : item.tone === 'watch' ? 'Watch' : 'Critical'}
                        </span>
                        <span className={cx(ANALYTICS_META_CHIP_CLASS, 'text-xs')}>
                          Score {formatNumber(item.opportunityScore)}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{item.detail}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span
                        className={`rounded-full border px-3 py-1 font-semibold ${getDeltaToneClass(
                          item.momentumDelta,
                          'higher_better'
                        )}`}
                      >
                        Momentum {formatDelta(item.momentumDelta)}
                      </span>
                      <span className={cx(ANALYTICS_META_CHIP_CLASS, 'text-xs')}>
                        Conversion {formatPercent(item.conversionRate)}
                      </span>
                      <span
                        className={`rounded-full border px-3 py-1 font-semibold ${getDeltaToneClass(
                          item.conversionDelta,
                          'higher_better'
                        )}`}
                      >
                        Conversion Delta {formatDelta(item.conversionDelta)} pts
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className={cx(ANALYTICS_EMPTY_STATE_CLASS, 'xl:col-span-2')}>
                  The opportunity matrix will appear once compare-period audience and conversion history is available.
                </div>
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className={ANALYTICS_PANEL_CLASS}>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Section Momentum</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Reader sections gaining or losing page-view momentum across the comparison window.
              </p>

              <div className="mt-6 space-y-3">
                {compare === 'previous' && analytics.audienceAnalytics.current.sectionTrends.length ? (
                  analytics.audienceAnalytics.current.sectionTrends.map((section) => (
                    <div
                      key={section.label}
                      className={ANALYTICS_SOFT_CARD_CLASS}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {section.label}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            Current {formatNumber(section.currentEvents)} / Previous {formatNumber(section.previousEvents)} page views
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getDeltaToneClass(
                            section.deltaEvents,
                            'higher_better'
                          )}`}
                        >
                          {formatDelta(section.deltaEvents)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                    Section momentum appears when `Previous Period` compare is enabled and audience history exists.
                  </div>
                )}
              </div>
            </section>

            <section className={ANALYTICS_PANEL_CLASS}>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Acquisition Momentum</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Which acquisition channels are improving or weakening across the selected periods.
              </p>

              <div className="mt-6 space-y-3">
                {compare === 'previous' && analytics.audienceAnalytics.current.channelTrends.length ? (
                  analytics.audienceAnalytics.current.channelTrends.map((channel) => (
                    <div
                      key={channel.label}
                      className={ANALYTICS_SOFT_CARD_CLASS}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {channel.label}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            Current {formatNumber(channel.currentEvents)} / Previous {formatNumber(channel.previousEvents)} events
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getDeltaToneClass(
                            channel.deltaEvents,
                            'higher_better'
                          )}`}
                        >
                          {formatDelta(channel.deltaEvents)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                    Acquisition momentum appears when `Previous Period` compare is enabled and audience history exists.
                  </div>
                )}
              </div>
            </section>
          </section>
        </>
      )}
    </>
  );
}

function TrendCard({ trend }: { trend: AnalyticsTrendCard }) {
  return (
    <div className={ANALYTICS_PANEL_CLASS}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{trend.label}</p>
          <p className="mt-3 text-3xl font-black text-zinc-900 dark:text-zinc-100">
            {formatNumber(trend.currentValue)}
          </p>
        </div>
        <div className={`rounded-2xl p-3 ${trend.tone}`}>
          <trend.icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-xs">
        <span className={cx(ANALYTICS_META_CHIP_CLASS, 'text-xs')}>
          Current {formatNumber(trend.currentValue)}
        </span>
        {trend.previousValue !== null ? (
          <>
            <span className={cx(ANALYTICS_META_CHIP_CLASS, 'text-xs')}>
              Previous {formatNumber(trend.previousValue)}
            </span>
            <span
              className={`rounded-full border px-3 py-1 font-semibold ${getDeltaToneClass(
                trend.delta || 0,
                trend.preference
              )}`}
            >
              Delta {formatDelta(trend.delta || 0)}
            </span>
          </>
        ) : (
          <span className={cx(ANALYTICS_META_CHIP_CLASS, 'text-xs')}>
            Compare off
          </span>
        )}
      </div>

      <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{trend.detail}</p>
    </div>
  );
}

function ServiceStatusPill({ status }: { status: 'healthy' | 'watch' | 'critical' | 'inactive' }) {
  const toneClass =
    status === 'healthy'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
      : status === 'watch'
        ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300'
        : status === 'critical'
          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300'
          : 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}>
      {formatStatusLabel(status)}
    </span>
  );
}

function RuntimeSignalPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'neutral' | 'good' | 'warning' | 'critical';
}) {
  const toneClass =
    tone === 'good'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300'
        : tone === 'critical'
          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300'
          : 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
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

function AudienceConversionLeadersCard({
  title,
  description,
  rows,
  trends,
  emptyMessage,
  showCompare,
}: {
  title: string;
  description: string;
  rows: Array<{
    label: string;
    detail?: string;
    sessions: number;
    conversionSessions: number;
    overallConversionRate: number;
    popupConversionRate: number;
    contactConversionRate: number;
  }>;
  trends: Array<{
    label: string;
    deltaConversionRate: number;
  }>;
  emptyMessage: string;
  showCompare: boolean;
}) {
  return (
    <section className={ANALYTICS_PANEL_CLASS}>
      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{description}</p>

      <div className="mt-6 space-y-3">
        {rows.length ? (
          rows.map((row) => {
            const trend = trends.find((item) => item.label === row.label) || null;
            return (
              <div
                key={row.label}
                className={ANALYTICS_SOFT_CARD_CLASS}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {row.label}
                    </p>
                    {row.detail ? (
                      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        {row.detail}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatNumber(row.conversionSessions)} converting session(s) from{' '}
                      {formatNumber(row.sessions)} tracked session(s)
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                    {formatPercent(row.overallConversionRate)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className={cx(ANALYTICS_META_CHIP_CLASS, 'text-xs')}>
                    Popup {formatPercent(row.popupConversionRate)}
                  </span>
                  <span className={cx(ANALYTICS_META_CHIP_CLASS, 'text-xs')}>
                    Contact {formatPercent(row.contactConversionRate)}
                  </span>
                  {showCompare && trend ? (
                    <span
                      className={`rounded-full border px-3 py-1 font-semibold ${getDeltaToneClass(trend.deltaConversionRate, 'higher_better')}`}
                    >
                      Rate {trend.deltaConversionRate > 0 ? '+' : ''}
                      {formatPercent(trend.deltaConversionRate)}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })
        ) : (
          <div className={ANALYTICS_EMPTY_STATE_CLASS}>
            {emptyMessage}
          </div>
        )}
      </div>
    </section>
  );
}

function WorkflowList({
  title,
  description,
  items,
  emptyMessage,
}: {
  title: string;
  description: string;
  items: WorkflowArticleCard[];
  emptyMessage: string;
}) {
  return (
    <section className={ANALYTICS_PANEL_CLASS}>
      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{description}</p>

      <div className="mt-6 space-y-3">
        {items.length ? (
          items.map((item) => (
            <Link
              key={`${item.contentType}-${item.id}`}
              href={item.editHref}
              className={cx(
                'block transition-colors hover:border-zinc-300/90 hover:bg-zinc-100/80 dark:hover:border-white/15 dark:hover:bg-white/[0.06]',
                ANALYTICS_SOFT_CARD_CLASS
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
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                <span>Updated {formatUiDate(item.updatedAt, item.updatedAt)}</span>
                {item.assignedToName ? <span>Assignee: {item.assignedToName}</span> : null}
              </div>
            </Link>
          ))
        ) : (
          <div className={ANALYTICS_EMPTY_STATE_CLASS}>
            {emptyMessage}
          </div>
        )}
      </div>
    </section>
  );
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const admin = await getAdminSession();
  if (!admin) {
    redirect('/signin?redirect=/admin/analytics');
  }
  if (!canViewPage(admin.role, 'analytics')) {
    redirect('/admin');
  }

  const params = await searchParams;
  const activeTab = parseTab(readSearchParam(params.tab));
  const focus = parseFocus(readSearchParam(params.focus));
  const contentFilter = parseContentFilter(readSearchParam(params.content));
  const range = parseRange(readSearchParam(params.range));
  const compare = parseCompare(readSearchParam(params.compare));
  const isSuperAdminView = admin.role === 'super_admin';
  const showLeadershipBriefings = admin.role === 'super_admin' || admin.role === 'admin';
  const [
    analytics,
    leadershipReports,
    leadershipSchedules,
    leadershipRunHistory,
    leadershipAlertNotifications,
    leadershipCriticalAlertState,
  ] = await Promise.all([
    getAnalyticsCenterData({ range, compare }),
    showLeadershipBriefings ? getLeadershipReportPresetCollection() : Promise.resolve([]),
    showLeadershipBriefings ? listLeadershipReportSchedules() : Promise.resolve([]),
    showLeadershipBriefings ? listLeadershipReportRunHistory(60) : Promise.resolve([]),
    showLeadershipBriefings ? listLeadershipReportAlertNotificationHistory(12) : Promise.resolve([]),
    showLeadershipBriefings
      ? getLeadershipReportCriticalAlertState()
      : Promise.resolve(null),
  ]);
  const leadershipRuntime = showLeadershipBriefings
    ? await getLeadershipReportRuntimeSnapshot(leadershipSchedules)
    : null;
  const leadershipHealthAlerts =
    showLeadershipBriefings && leadershipRuntime
      ? buildLeadershipReportHealthAlerts({
          schedules: leadershipSchedules,
          history: leadershipRunHistory,
          runtime: leadershipRuntime,
        })
      : [];
  const leadershipEscalations =
    showLeadershipBriefings && leadershipRuntime
      ? buildLeadershipReportEscalations({
          schedules: leadershipSchedules,
          history: leadershipRunHistory,
          runtime: leadershipRuntime,
        })
      : [];

  const currentReviewItems = analytics.currentPeriod.reviewItems;
  const currentReadyItems = analytics.currentPeriod.readyDecisionItems;
  const currentQueueMetrics = analytics.currentPeriod.queueMetrics;
  const currentBlockedEditions = analytics.currentPeriod.blockedEditions;
  const currentLowQualityPages = analytics.currentPeriod.lowQualityPages;
  const currentRecentSignIns = analytics.currentPeriod.recentSignInMembers;
  const comparisonDeltas = analytics.comparison.deltas;
  const previousPeriod = analytics.comparison.previousPeriod;
  const shareHref = buildAnalyticsHref(params, {});
  const exportHref = buildAnalyticsExportHref(params);
  const superAdminPrimaryTabs = ANALYTICS_TABS.filter((tab) =>
    SUPER_ADMIN_PRIMARY_TABS.includes(tab.id)
  );
  const visibleTabs =
    isSuperAdminView && !superAdminPrimaryTabs.some((tab) => tab.id === activeTab)
      ? ANALYTICS_TABS.filter(
          (tab) => SUPER_ADMIN_PRIMARY_TABS.includes(tab.id) || tab.id === activeTab
        )
      : isSuperAdminView
        ? superAdminPrimaryTabs
        : ANALYTICS_TABS;
  const visiblePresets = isSuperAdminView
    ? ANALYTICS_VIEW_PRESETS.filter((preset) =>
        SUPER_ADMIN_QUICK_VIEW_PRESETS.includes(
          preset.id as (typeof SUPER_ADMIN_QUICK_VIEW_PRESETS)[number]
        )
      )
    : ANALYTICS_VIEW_PRESETS;
  const audienceDeltas = analytics.audienceAnalytics.deltas;
  const activePresetId =
    ANALYTICS_VIEW_PRESETS.find((preset) =>
      matchesPreset(preset, {
        tab: activeTab,
        focus,
        content: contentFilter,
        range,
        compare,
      })
    )?.id || null;
  const growthInsights = buildBusinessGrowthInsights({
    sectionBreakdown: analytics.audienceAnalytics.current.sectionBreakdown,
    sectionTrends: analytics.audienceAnalytics.current.sectionTrends,
    sectionConversionBreakdown:
      analytics.audienceAnalytics.current.sectionConversionBreakdown,
    sectionConversionTrends:
      analytics.audienceAnalytics.current.sectionConversionTrends,
    channelBreakdown: analytics.audienceAnalytics.current.channelBreakdown,
    channelTrends: analytics.audienceAnalytics.current.channelTrends,
    channelConversionBreakdown:
      analytics.audienceAnalytics.current.channelConversionBreakdown,
    channelConversionTrends:
      analytics.audienceAnalytics.current.channelConversionTrends,
    pathConversionLeaders:
      analytics.audienceAnalytics.current.pathConversionLeaders,
    pathConversionLaggards:
      analytics.audienceAnalytics.current.pathConversionLaggards,
  });
  const liveChartsSnapshot = buildAnalyticsLiveChartsSnapshot(analytics);

  const filteredQueueItems = currentReviewItems.filter(
    (item) => matchesContentFilter(item, contentFilter) && matchesNewsroomFocus(item, focus)
  );
  const filteredReadyItems = currentReadyItems.filter(
    (item) => matchesContentFilter(item, contentFilter) && matchesNewsroomFocus(item, focus)
  );

  const submittedCount = countItemsByStatuses(currentReviewItems, ['submitted']);
  const activeDeskCount = countItemsByStatuses(currentReviewItems, [
    'assigned',
    'in_review',
    'copy_edit',
    'changes_requested',
    'pages_ready',
    'ocr_review',
    'hotspot_mapping',
    'qa_review',
  ]);
  const qualityWatchCount = countQualityPagesByLabel(currentLowQualityPages, 'Watch');
  const qualityNeedsRecheckCount = countQualityPagesByLabel(
    currentLowQualityPages,
    'Needs Recheck'
  );
  const qualityPendingQaCount = countQualityPagesByReviewStatus(currentLowQualityPages, 'pending');
  const qualityNeedsAttentionCount = countQualityPagesByReviewStatus(
    currentLowQualityPages,
    'needs_attention'
  );

  const overviewMetrics: AnalyticsMetricCard[] = [
    {
      label: 'Content Inventory',
      value: analytics.contentInventory.total,
      detail: 'Total articles, videos, and e-paper editions under platform oversight.',
      icon: Layers3,
      tone: 'bg-blue-500/10 text-blue-600',
    },
    {
      label: 'Workflow Pressure',
      value: currentQueueMetrics.queuePressure,
      detail: 'Editorial and edition work currently needing desk attention.',
      icon: TimerReset,
      tone: 'bg-violet-500/10 text-violet-600',
    },
    {
      label: 'Ready Decisions',
      value: currentQueueMetrics.readyDecisions,
      detail: `Content or editions already cleared and waiting for release attention in ${analytics.timeWindow.label.toLowerCase()}.`,
      icon: CheckCircle2,
      tone: 'bg-emerald-500/10 text-emerald-600',
    },
    {
      label: 'Blocked Editions',
      value: currentBlockedEditions.length,
      detail: 'E-paper editions still blocked by QA, hotspot, or extraction issues.',
      icon: AlertTriangle,
      tone: 'bg-orange-500/10 text-orange-600',
    },
    {
      label: 'Inbox Escalations',
      value: analytics.dashboard.inbox.new,
      detail: 'Reader or operations messages still waiting for leadership visibility.',
      icon: MessageSquareMore,
      tone: 'bg-red-500/10 text-red-600',
    },
    {
      label: 'Team Coverage',
      value: analytics.teamHealth.totals.active,
      detail: 'Active admin-side team members currently available across the desk.',
      icon: UserCog,
      tone: 'bg-cyan-500/10 text-cyan-600',
    },
  ];

  const newsroomMetrics: AnalyticsMetricCard[] = [
    {
      label: 'Submitted',
      value: submittedCount,
      detail: `Items updated in ${analytics.timeWindow.label.toLowerCase()} and still waiting for first desk pickup.`,
      icon: FileText,
      tone: 'bg-blue-500/10 text-blue-600',
    },
    {
      label: 'Active Desk Work',
      value: activeDeskCount,
      detail: `Editorial review, copy-edit, and edition-production work touched in ${analytics.timeWindow.label.toLowerCase()}.`,
      icon: Clock3,
      tone: 'bg-amber-500/10 text-amber-600',
    },
    {
      label: 'Ready To Publish',
      value: currentQueueMetrics.readyDecisions,
      detail: `Items already approved or scheduled and waiting for release action in ${analytics.timeWindow.label.toLowerCase()}.`,
      icon: CheckCircle2,
      tone: 'bg-emerald-500/10 text-emerald-600',
    },
    {
      label: 'Queue Volume',
      value: currentQueueMetrics.reviewVolume,
      detail: `Mixed queue volume updated in ${analytics.timeWindow.label.toLowerCase()} across articles, stories, videos, and editions.`,
      icon: Layers3,
      tone: 'bg-violet-500/10 text-violet-600',
    },
  ];

  const epaperMetrics: AnalyticsMetricCard[] = [
    {
      label: 'Edition Activity',
      value: currentQueueMetrics.queueByType.epaper,
      detail: `Editions touched during ${analytics.timeWindow.label.toLowerCase()} across production and review stages.`,
      icon: Newspaper,
      tone: 'bg-blue-500/10 text-blue-600',
    },
    {
      label: 'Ready To Publish',
      value: currentQueueMetrics.readyEditionCount,
      detail: `Editions that reached ready-to-publish status in ${analytics.timeWindow.label.toLowerCase()}.`,
      icon: CheckCircle2,
      tone: 'bg-emerald-500/10 text-emerald-600',
    },
    {
      label: 'Blocked Editions',
      value: currentBlockedEditions.length,
      detail: `Editions still blocked by quality or coverage issues in ${analytics.timeWindow.label.toLowerCase()}.`,
      icon: Clock3,
      tone: 'bg-amber-500/10 text-amber-600',
    },
    {
      label: 'Quality Alerts',
      value: currentLowQualityPages.length,
      detail: `Low-quality pages flagged for OCR, hotspot, or QA cleanup in ${analytics.timeWindow.label.toLowerCase()}.`,
      icon: AlertTriangle,
      tone: 'bg-red-500/10 text-red-600',
    },
  ];

  const teamMetrics: AnalyticsMetricCard[] = [
    {
      label: 'Admin Users',
      value: analytics.teamHealth.totals.adminUsers,
      detail: 'Total team members with admin-side access.',
      icon: UserCog,
      tone: 'bg-blue-500/10 text-blue-600',
    },
    {
      label: 'Active',
      value: analytics.teamHealth.totals.active,
      detail: 'Accounts currently active and available for workflow operations.',
      icon: CheckCircle2,
      tone: 'bg-emerald-500/10 text-emerald-600',
    },
    {
      label: 'Inactive',
      value: analytics.teamHealth.totals.inactive,
      detail: 'Accounts that are currently disabled or unavailable.',
      icon: AlertTriangle,
      tone: 'bg-amber-500/10 text-amber-600',
    },
    {
      label: 'Recent Sign-ins',
      value: currentRecentSignIns.length,
      detail: `Admin-side accounts seen during ${analytics.timeWindow.label.toLowerCase()}.`,
      icon: Clock3,
      tone: 'bg-violet-500/10 text-violet-600',
    },
  ];

  const audienceMetrics: AnalyticsMetricCard[] = [
    {
      label: 'Page Views',
      value: analytics.audienceAnalytics.current.metrics.pageViews,
      detail: `Public page-view events captured during ${analytics.timeWindow.label.toLowerCase()}.`,
      icon: Globe2,
      tone: 'bg-blue-500/10 text-blue-600',
    },
    {
      label: 'Audience Events',
      value: analytics.audienceAnalytics.current.metrics.events,
      detail: `Reader-facing engagement and contact events captured during ${analytics.timeWindow.label.toLowerCase()}.`,
      icon: Activity,
      tone: 'bg-violet-500/10 text-violet-600',
    },
    {
      label: 'Active Sessions',
      value: analytics.audienceAnalytics.current.metrics.sessions,
      detail: 'Unique tracked browser sessions seen in the selected reporting window.',
      icon: UserCog,
      tone: 'bg-cyan-500/10 text-cyan-600',
    },
    {
      label: 'Contact Successes',
      value: analytics.audienceAnalytics.current.metrics.contactSuccesses,
      detail: 'Successful contact-form submissions captured by the current audience instrumentation.',
      icon: MessageSquareMore,
      tone: 'bg-emerald-500/10 text-emerald-600',
    },
    {
      label: 'Popup Conversions',
      value: analytics.audienceAnalytics.current.metrics.popupSuccesses,
      detail: 'Successful engagement-popup submissions converted during the selected time window.',
      icon: CheckCircle2,
      tone: 'bg-orange-500/10 text-orange-600',
    },
  ];

  const systemMetrics: AnalyticsMetricCard[] = [
    {
      label: 'Service Risks',
      value: analytics.systemHealth.metrics.serviceRisks,
      detail: 'Platform services currently in watch or critical state.',
      icon: AlertTriangle,
      tone: 'bg-red-500/10 text-red-600',
    },
    {
      label: 'Recent Failures',
      value: analytics.systemHealth.metrics.recentFailures,
      detail: `TTS failure events recorded during ${analytics.timeWindow.label.toLowerCase()}.`,
      icon: Clock3,
      tone: 'bg-amber-500/10 text-amber-600',
    },
    {
      label: 'Failed Assets',
      value: analytics.systemHealth.metrics.failedAssets,
      detail: 'Shared TTS assets currently marked failed in storage.',
      icon: FileText,
      tone: 'bg-orange-500/10 text-orange-600',
    },
    {
      label: 'Enabled Surfaces',
      value: analytics.systemHealth.metrics.enabledSurfaces,
      detail: 'TTS surfaces currently enabled in the runtime configuration.',
      icon: CheckCircle2,
      tone: 'bg-emerald-500/10 text-emerald-600',
    },
  ];

  const contentMetrics: AnalyticsMetricCard[] = [
    {
      label: 'Articles',
      value: analytics.contentInventory.articles,
      detail: 'Total article inventory available to the newsroom.',
      icon: FileText,
      tone: 'bg-blue-500/10 text-blue-600',
    },
    {
      label: 'Stories',
      value: analytics.contentInventory.stories,
      detail: 'Short-form story items currently tracked in the system.',
      icon: Layers3,
      tone: 'bg-violet-500/10 text-violet-600',
    },
    {
      label: 'Videos',
      value: analytics.contentInventory.videos,
      detail: 'Video inventory currently available across the platform.',
      icon: Video,
      tone: 'bg-emerald-500/10 text-emerald-600',
    },
    {
      label: 'E-Papers',
      value: analytics.contentInventory.epapers,
      detail: 'Editions currently stored in the newsroom system.',
      icon: Newspaper,
      tone: 'bg-orange-500/10 text-orange-600',
    },
  ];

  const growthMetrics: AnalyticsMetricCard[] = [
    {
      label: 'Section Leaders',
      value: growthInsights.sectionLeaders.length,
      detail: 'Sections currently showing the best combined momentum and conversion signals.',
      icon: Layers3,
      tone: 'bg-emerald-500/10 text-emerald-600',
    },
    {
      label: 'Channel Wins',
      value: growthInsights.channelLeaders.length,
      detail: 'Acquisition channels currently outperforming on momentum and conversion.',
      icon: Globe2,
      tone: 'bg-blue-500/10 text-blue-600',
    },
    {
      label: 'Opportunities',
      value: growthInsights.opportunities.length,
      detail: 'High-upside section and channel opportunities ranked by business impact.',
      icon: TrendingUp,
      tone: 'bg-violet-500/10 text-violet-600',
    },
    {
      label: 'Watch Signals',
      value: growthInsights.watchlist.length,
      detail: 'Growth signals that leadership should lean into or investigate next.',
      icon: AlertTriangle,
      tone: 'bg-orange-500/10 text-orange-600',
    },
  ];
  const superAdminOverviewMetrics = overviewMetrics;
  const superAdminNewsroomMetrics = newsroomMetrics.filter(
    (metric) => metric.label !== 'Queue Volume'
  );
  const superAdminGrowthMetrics = growthMetrics.filter(
    (metric) => metric.label !== 'Opportunities'
  );
  const superAdminSystemMetrics = systemMetrics.filter(
    (metric) => metric.label !== 'Enabled Surfaces'
  );

  const contentTypeTrendRows = previousPeriod
    ? [
        {
          label: 'Articles',
          current: currentQueueMetrics.queueByType.article,
          previous: previousPeriod.queueMetrics.queueByType.article,
          delta:
            currentQueueMetrics.queueByType.article -
            previousPeriod.queueMetrics.queueByType.article,
        },
        {
          label: 'Stories',
          current: currentQueueMetrics.queueByType.story,
          previous: previousPeriod.queueMetrics.queueByType.story,
          delta:
            currentQueueMetrics.queueByType.story -
            previousPeriod.queueMetrics.queueByType.story,
        },
        {
          label: 'Videos',
          current: currentQueueMetrics.queueByType.video,
          previous: previousPeriod.queueMetrics.queueByType.video,
          delta:
            currentQueueMetrics.queueByType.video -
            previousPeriod.queueMetrics.queueByType.video,
        },
        {
          label: 'E-Papers',
          current: currentQueueMetrics.queueByType.epaper,
          previous: previousPeriod.queueMetrics.queueByType.epaper,
          delta:
            currentQueueMetrics.queueByType.epaper -
            previousPeriod.queueMetrics.queueByType.epaper,
        },
      ]
    : [];

  const compareTrends: AnalyticsTrendCard[] = [
    {
      label: 'Review Volume',
      currentValue: currentQueueMetrics.reviewVolume,
      previousValue: previousPeriod?.queueMetrics.reviewVolume ?? null,
      delta: comparisonDeltas?.reviewVolume ?? null,
      detail: `All queue activity seen during ${analytics.timeWindow.label.toLowerCase()} compared with the prior matching window.`,
      icon: Layers3,
      tone: 'bg-violet-500/10 text-violet-600',
      preference: 'higher_better',
    },
    {
      label: 'Ready Decisions',
      currentValue: currentQueueMetrics.readyDecisions,
      previousValue: previousPeriod?.queueMetrics.readyDecisions ?? null,
      delta: comparisonDeltas?.readyDecisions ?? null,
      detail: 'Release-ready content and editions that leadership can move forward right now.',
      icon: CheckCircle2,
      tone: 'bg-emerald-500/10 text-emerald-600',
      preference: 'higher_better',
    },
    {
      label: 'Blocked Editions',
      currentValue: currentBlockedEditions.length,
      previousValue: previousPeriod?.blockedEditions.length ?? null,
      delta: comparisonDeltas?.blockedEditions ?? null,
      detail: 'Editions still held back by publish blockers, quality issues, or missing coverage.',
      icon: Newspaper,
      tone: 'bg-orange-500/10 text-orange-600',
      preference: 'lower_better',
    },
    {
      label: 'Quality Alerts',
      currentValue: currentLowQualityPages.length,
      previousValue: previousPeriod?.lowQualityPages.length ?? null,
      delta: comparisonDeltas?.qualityAlerts ?? null,
      detail: 'Low-quality pages needing OCR, hotspot, or QA cleanup from the selected window.',
      icon: AlertTriangle,
      tone: 'bg-red-500/10 text-red-600',
      preference: 'lower_better',
    },
  ];

  return (
    <div className="mx-auto max-w-[1640px] space-y-8">
      <AnalyticsHeroSection
        roleLabel={formatUserRoleLabel(admin.role)}
        sourceLabel={formatSourceLabel(analytics.dashboard.source)}
        activeTab={ANALYTICS_TABS.find((tab) => tab.id === activeTab)?.label || 'Overview'}
        rangeLabel={analytics.timeWindow.label}
        compareLabel={
          compare === 'previous'
            ? analytics.timeWindow.compareLabel
            : 'Comparison Off'
        }
      />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-8">
        {visibleTabs.map((tab) => (
          <TabLink
            key={tab.id}
            href={buildAnalyticsHref(params, { tab: tab.id })}
            label={tab.label}
            description={tab.description}
            icon={tab.icon}
            active={activeTab === tab.id}
          />
        ))}
      </section>

      {isSuperAdminView ? (
        <section className={ANALYTICS_PANEL_CLASS}>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Quick Views
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Jump between the main executive views and share the current page without adding
                extra panels above the data.
              </p>
            </div>
            <AnalyticsShareActions shareHref={shareHref} exportHref={exportHref} />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {visiblePresets.map((preset) => (
              <FilterChip
                key={preset.id}
                href={buildAnalyticsPresetHref(preset)}
                label={preset.label}
                active={activePresetId === preset.id}
              />
            ))}
            <Link
              href="/admin/analytics?tab=overview&focus=all&content=all&range=30d&compare=off"
              className={ANALYTICS_LINK_CLASS}
            >
              Reset To Default
            </Link>
          </div>
        </section>
      ) : (
        <section className={ANALYTICS_PANEL_CLASS}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Saved Views</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                One-click leadership views for the most common analytics questions.
              </p>
            </div>
            <Link
              href="/admin/analytics?tab=overview&focus=all&content=all&range=30d&compare=off"
              className={ANALYTICS_LINK_CLASS}
            >
              Reset To Default
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {visiblePresets.map((preset) => (
              <PresetLink
                key={preset.id}
                href={buildAnalyticsPresetHref(preset)}
                label={preset.label}
                description={preset.description}
                active={activePresetId === preset.id}
              />
            ))}
          </div>
        </section>
      )}

      {showLeadershipBriefings ? (
        isSuperAdminView ? (
          <section className={ANALYTICS_PANEL_CLASS}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  Reports & Delivery
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Keep reporting tools available, but collapsed until you need them.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={ANALYTICS_META_CHIP_CLASS}>
                  Reports {leadershipReports.length}
                </span>
                <span className={ANALYTICS_META_CHIP_CLASS}>
                  Schedules {leadershipSchedules.length}
                </span>
                <span className={ANALYTICS_META_CHIP_CLASS}>
                  Health Alerts {leadershipHealthAlerts.length}
                </span>
                <span className={ANALYTICS_META_CHIP_CLASS}>
                  Escalations {leadershipEscalations.length}
                </span>
              </div>
            </div>

            <details className="mt-6 rounded-[24px] border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface)] p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[color:var(--admin-shell-text)]">
                Open Briefing Reports
              </summary>
              <div className="mt-4 grid grid-cols-1 gap-6">
                {leadershipReports.map((report) => (
                  <LeadershipReportCard key={report.id} report={report} />
                ))}
              </div>
            </details>

            <details className="mt-4 rounded-[24px] border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface)] p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[color:var(--admin-shell-text)]">
                Open Delivery Controls
              </summary>
              <div className="mt-4">
                <LeadershipReportDeliveryPanel
                  initialSchedules={leadershipSchedules}
                  initialHistory={leadershipRunHistory}
                  initialAlertNotifications={leadershipAlertNotifications}
                  initialCriticalAlertState={leadershipCriticalAlertState}
                  initialHealthAlerts={leadershipHealthAlerts}
                  initialEscalations={leadershipEscalations}
                  emailDeliveryConfigured={leadershipRuntime?.emailDeliveryConfigured ?? false}
                />
              </div>
            </details>
          </section>
        ) : (
          <>
            <section className="space-y-4">
              <div className={ANALYTICS_PANEL_CLASS}>
                <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      Leadership Briefings
                    </h2>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                      Ready-made daily, weekly, and monthly management briefings built from the live
                      analytics foundation. Each briefing can be opened as a preset dashboard view or
                      downloaded as a markdown report for sharing.
                    </p>
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Built from newsroom, audience, e-paper, team, and system-health signals.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {leadershipReports.map((report) => (
                  <LeadershipReportCard key={report.id} report={report} />
                ))}
              </div>
            </section>

            <LeadershipReportDeliveryPanel
              initialSchedules={leadershipSchedules}
              initialHistory={leadershipRunHistory}
              initialAlertNotifications={leadershipAlertNotifications}
              initialCriticalAlertState={leadershipCriticalAlertState}
              initialHealthAlerts={leadershipHealthAlerts}
              initialEscalations={leadershipEscalations}
              emailDeliveryConfigured={leadershipRuntime?.emailDeliveryConfigured ?? false}
            />
          </>
        )
      ) : null}

      <section className={ANALYTICS_PANEL_CLASS}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {isSuperAdminView ? 'Controls' : 'Filter Bar'}
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              {isSuperAdminView
                ? 'Change the time window and comparison first. Open advanced filters only when needed.'
                : 'Focus the analytics view by date window, comparison, newsroom signal, and content type.'}
            </p>
          </div>
          <div className="space-y-4 xl:max-w-4xl">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Date Range
              </p>
              <div className="flex flex-wrap gap-2">
                {RANGE_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.id}
                    href={buildAnalyticsHref(params, { range: option.id })}
                    label={option.label}
                    active={range === option.id}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Compare
              </p>
              <div className="flex flex-wrap gap-2">
                {COMPARE_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.id}
                    href={buildAnalyticsHref(params, { compare: option.id })}
                    label={option.label}
                    active={compare === option.id}
                  />
                ))}
              </div>
            </div>
            {isSuperAdminView ? (
              <details className="rounded-[24px] border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface)] p-4">
                <summary className="cursor-pointer text-sm font-semibold text-[color:var(--admin-shell-text)]">
                  Advanced Filters
                </summary>
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Signal Focus
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {FOCUS_OPTIONS.map((option) => (
                        <FilterChip
                          key={option.id}
                          href={buildAnalyticsHref(params, { focus: option.id })}
                          label={option.label}
                          active={focus === option.id}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Content Filter
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {CONTENT_FILTER_OPTIONS.map((option) => (
                        <FilterChip
                          key={option.id}
                          href={buildAnalyticsHref(params, { content: option.id })}
                          label={option.label}
                          active={contentFilter === option.id}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </details>
            ) : (
              <>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Signal Focus
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {FOCUS_OPTIONS.map((option) => (
                      <FilterChip
                        key={option.id}
                        href={buildAnalyticsHref(params, { focus: option.id })}
                        label={option.label}
                        active={focus === option.id}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Content Filter
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CONTENT_FILTER_OPTIONS.map((option) => (
                      <FilterChip
                        key={option.id}
                        href={buildAnalyticsHref(params, { content: option.id })}
                        label={option.label}
                        active={contentFilter === option.id}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {!isSuperAdminView ? (
      <section className={ANALYTICS_PANEL_CLASS}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Window Summary</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Viewing {analytics.timeWindow.label}
              {compare === 'previous'
                ? ` compared with ${analytics.timeWindow.compareLabel.toLowerCase()}.`
                : ' with comparison turned off.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {comparisonDeltas ? (
              <>
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getDeltaToneClass(comparisonDeltas.reviewVolume, 'higher_better')}`}
                >
                  Review Volume {formatDelta(comparisonDeltas.reviewVolume)}
                </span>
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getDeltaToneClass(comparisonDeltas.readyDecisions, 'higher_better')}`}
                >
                  Ready Decisions {formatDelta(comparisonDeltas.readyDecisions)}
                </span>
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getDeltaToneClass(comparisonDeltas.blockedEditions, 'lower_better')}`}
                >
                  Blocked Editions {formatDelta(comparisonDeltas.blockedEditions)}
                </span>
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getDeltaToneClass(comparisonDeltas.qualityAlerts, 'lower_better')}`}
                >
                  Quality Alerts {formatDelta(comparisonDeltas.qualityAlerts)}
                </span>
              </>
            ) : (
              <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                Enable comparison to see period deltas.
              </span>
            )}
          </div>
        </div>
      </section>
      ) : null}

      {!isSuperAdminView || compare === 'previous' ? (
      <section className={ANALYTICS_PANEL_CLASS}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {isSuperAdminView ? 'Period Deltas' : 'Compare Panel'}
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              {isSuperAdminView
                ? 'Period-over-period movement for the leadership signals that matter most.'
                : 'Dedicated period-over-period cards for the leadership signals that matter most.'}
            </p>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {compare === 'previous'
              ? `${analytics.timeWindow.label} vs ${analytics.timeWindow.compareLabel.toLowerCase()}`
              : 'Turn on comparison to unlock previous-period deltas.'}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {compareTrends.map((trend) => (
            <TrendCard key={trend.label} trend={trend} />
          ))}
        </div>
      </section>
      ) : null}

      {!isSuperAdminView ? (
      <section className={ANALYTICS_PANEL_CLASS}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Export & Share</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Download the current analytics view as CSV or copy a shareable report link with the
              active tab, filters, date range, and comparison state.
            </p>
          </div>
          <AnalyticsShareActions shareHref={shareHref} exportHref={exportHref} />
        </div>
      </section>
      ) : null}

      {activeTab === 'overview' ? (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            {(isSuperAdminView ? superAdminOverviewMetrics : overviewMetrics).map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </section>

          <AnalyticsLiveCharts
            initialSnapshot={liveChartsSnapshot}
            activeTab={activeTab}
            range={range}
            compare={compare}
          />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr,1fr]">
            <WorkflowList
              title="Decision-Ready Items"
              description={`Content and edition work already cleared for publish or leadership release decisions in ${analytics.timeWindow.label.toLowerCase()}.`}
              items={filteredReadyItems.slice(0, isSuperAdminView ? 4 : 6)}
              emptyMessage="No publish-ready items match the current filters."
            />

            <section className={ANALYTICS_PANEL_CLASS}>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {isSuperAdminView ? 'Leadership Focus' : 'Operational Summary'}
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                {isSuperAdminView
                  ? 'Keep the right-side panel focused on active blockers, risk, and team readiness.'
                  : 'A quick read on where leadership attention should go next.'}
              </p>

              {isSuperAdminView ? (
                <>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <span className={ANALYTICS_META_CHIP_CLASS}>
                      Review Volume {formatNumber(currentQueueMetrics.reviewVolume)}
                    </span>
                    <span className={ANALYTICS_META_CHIP_CLASS}>
                      Active Team {formatNumber(analytics.teamHealth.totals.active)}
                    </span>
                    <span className={ANALYTICS_META_CHIP_CLASS}>
                      Quality Alerts {formatNumber(currentLowQualityPages.length)}
                    </span>
                  </div>

                  <div className="mt-5 space-y-3">
                    {currentBlockedEditions.length ? (
                      currentBlockedEditions.slice(0, 3).map((edition) => (
                        <Link
                          key={edition.epaperId}
                          href={edition.editHref}
                          className={cx('block transition-colors hover:border-zinc-300/90 hover:bg-zinc-100/80 dark:hover:border-white/15 dark:hover:bg-white/[0.06]', ANALYTICS_SOFT_CARD_CLASS)}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                {edition.title}
                              </p>
                              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                {edition.cityName} / {edition.blockerCount} blocker{edition.blockerCount === 1 ? '' : 's'}
                              </p>
                            </div>
                            <WorkflowPill status={edition.productionStatus} />
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                        No blocked editions are active right now.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Queue Mix
                      </p>
                      <div className="mt-3 space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
                        <p>Articles: {formatNumber(currentQueueMetrics.queueByType.article)}</p>
                        <p>Stories: {formatNumber(currentQueueMetrics.queueByType.story)}</p>
                        <p>Videos: {formatNumber(currentQueueMetrics.queueByType.video)}</p>
                        <p>Editions: {formatNumber(currentQueueMetrics.queueByType.epaper)}</p>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Team Signals
                      </p>
                      <div className="mt-3 space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
                        <p>Active: {formatNumber(analytics.teamHealth.totals.active)}</p>
                        <p>Inactive: {formatNumber(analytics.teamHealth.totals.inactive)}</p>
                        <p>Never signed in: {formatNumber(analytics.teamHealth.totals.neverLoggedIn)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {currentBlockedEditions.length ? (
                      currentBlockedEditions.slice(0, 4).map((edition) => (
                        <Link
                          key={edition.epaperId}
                          href={edition.editHref}
                          className={cx('block transition-colors hover:border-zinc-300/90 hover:bg-zinc-100/80 dark:hover:border-white/15 dark:hover:bg-white/[0.06]', ANALYTICS_SOFT_CARD_CLASS)}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                {edition.title}
                              </p>
                              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                {edition.cityName} / {edition.blockerCount} blocker{edition.blockerCount === 1 ? '' : 's'}
                              </p>
                            </div>
                            <WorkflowPill status={edition.productionStatus} />
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                        No blocked editions are active right now.
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          </section>
        </>
      ) : null}

      {activeTab === 'audience' ? (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {audienceMetrics.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </section>

          <AnalyticsLiveCharts
            initialSnapshot={liveChartsSnapshot}
            activeTab={activeTab}
            range={range}
            compare={compare}
          />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className={ANALYTICS_PANEL_CLASS}>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Audience Funnel</h2>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    Reader movement from page views into popup and contact conversions.
                  </p>
                </div>
                {audienceDeltas ? (
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getDeltaToneClass(audienceDeltas.pageViews, 'higher_better')}`}
                    >
                      Page Views {formatDelta(audienceDeltas.pageViews)}
                    </span>
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getDeltaToneClass(audienceDeltas.sessions, 'higher_better')}`}
                    >
                      Sessions {formatDelta(audienceDeltas.sessions)}
                    </span>
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getDeltaToneClass(audienceDeltas.contactSuccesses, 'higher_better')}`}
                    >
                      Contacts {formatDelta(audienceDeltas.contactSuccesses)}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Popup View To Submit
                  </p>
                  <p className="mt-2 text-2xl font-black text-zinc-900 dark:text-zinc-100">
                    {formatPercent(analytics.audienceAnalytics.current.conversion.popupViewToSubmitRate)}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                    {formatNumber(analytics.audienceAnalytics.current.metrics.popupViews)} popup view(s) to{' '}
                    {formatNumber(analytics.audienceAnalytics.current.metrics.popupSuccesses)} successful popup conversion(s).
                  </p>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Contact Start To Submit
                  </p>
                  <p className="mt-2 text-2xl font-black text-zinc-900 dark:text-zinc-100">
                    {formatPercent(analytics.audienceAnalytics.current.conversion.contactStartToSubmitRate)}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                    {formatNumber(analytics.audienceAnalytics.current.metrics.contactStarts)} contact start(s) to{' '}
                    {formatNumber(analytics.audienceAnalytics.current.metrics.contactSuccesses)} successful contact submission(s).
                  </p>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Session To Contact
                  </p>
                  <p className="mt-2 text-2xl font-black text-zinc-900 dark:text-zinc-100">
                    {formatPercent(analytics.audienceAnalytics.current.conversion.sessionToContactRate)}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                    Contact submissions as a share of tracked audience sessions.
                  </p>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Session To Popup
                  </p>
                  <p className="mt-2 text-2xl font-black text-zinc-900 dark:text-zinc-100">
                    {formatPercent(analytics.audienceAnalytics.current.conversion.sessionToPopupRate)}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                    Popup exposure rate across the tracked audience session base.
                  </p>
                </div>
              </div>
            </section>

            <section className={ANALYTICS_PANEL_CLASS}>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Page Type Mix</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Which reader surfaces are driving the most page views in the selected window.
              </p>

              <div className="mt-6 space-y-3">
                {analytics.audienceAnalytics.current.pageTypeBreakdown.length ? (
                  analytics.audienceAnalytics.current.pageTypeBreakdown.map((item) => (
                    <div
                      key={`${item.pageType}-${item.section}`}
                      className={ANALYTICS_SOFT_CARD_CLASS}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {item.pageType}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            Section: {item.section}
                          </p>
                        </div>
                        <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
                          <p>{formatNumber(item.events)} views</p>
                          <p className="mt-1">{formatNumber(item.sessions)} sessions</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                    Page-type breakdown will appear as public page views accumulate.
                  </div>
                )}
              </div>
            </section>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr,1.1fr]">
            <section className={ANALYTICS_PANEL_CLASS}>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Top Pages</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Reader-facing pages that generated the most tracked activity during{' '}
                {analytics.timeWindow.label.toLowerCase()}.
              </p>

              <div className="mt-6 space-y-3">
                {analytics.audienceAnalytics.current.topPages.length ? (
                  analytics.audienceAnalytics.current.topPages.map((page) => (
                    <div
                      key={page.page}
                      className={ANALYTICS_SOFT_CARD_CLASS}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {page.page}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            Last seen {formatUiDate(page.lastSeenAt, page.lastSeenAt)}
                          </p>
                        </div>
                        <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
                          <p>{formatNumber(page.events)} events</p>
                          <p className="mt-1">{formatNumber(page.sessions)} sessions</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                    No audience activity has been captured for this time window yet.
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-6">
              <section className={ANALYTICS_PANEL_CLASS}>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Source Breakdown</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Which tracked reader surfaces are generating the most activity.
                </p>

                <div className="mt-6 space-y-3">
                  {analytics.audienceAnalytics.current.sourceBreakdown.length ? (
                    analytics.audienceAnalytics.current.sourceBreakdown.map((source) => (
                      <div
                        key={source.source}
                        className={ANALYTICS_SOFT_CARD_CLASS}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {formatStatusLabel(source.source)}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              {formatNumber(source.sessions)} session(s)
                            </p>
                          </div>
                          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                            {formatNumber(source.events)} events
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                      Source data is not available yet.
                    </div>
                  )}
                </div>
              </section>

              <section className={ANALYTICS_PANEL_CLASS}>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Device Mix</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Which device classes are driving the most tracked audience activity.
                </p>

                <div className="mt-6 space-y-3">
                  {analytics.audienceAnalytics.current.deviceBreakdown.length ? (
                    analytics.audienceAnalytics.current.deviceBreakdown.map((device) => (
                      <div
                        key={device.device}
                        className={ANALYTICS_SOFT_CARD_CLASS}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {device.device}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              {formatNumber(device.sessions)} session(s)
                            </p>
                          </div>
                          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                            {formatNumber(device.events)} events
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                      Device mix will appear as fresh public audience events are captured.
                    </div>
                  )}
                </div>
              </section>

              <section className={ANALYTICS_PANEL_CLASS}>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Acquisition Mix</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  How readers are reaching Lokswami: direct, search, social, messaging, referral, or internal.
                </p>

                <div className="mt-6 space-y-3">
                  {analytics.audienceAnalytics.current.channelBreakdown.length ? (
                    analytics.audienceAnalytics.current.channelBreakdown.map((channel) => (
                      <div
                        key={channel.channel}
                        className={ANALYTICS_SOFT_CARD_CLASS}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {channel.channel}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              {formatNumber(channel.sessions)} session(s)
                            </p>
                          </div>
                          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                            {formatNumber(channel.events)} events
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                      Acquisition mix will improve as new tracked visits arrive with referrer metadata.
                    </div>
                  )}
                </div>
              </section>

              <section className={ANALYTICS_PANEL_CLASS}>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Campaign Mix</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Tagged campaigns reaching Lokswami through UTM source, medium, and campaign metadata.
                </p>

                <div className="mt-6 space-y-3">
                  {analytics.audienceAnalytics.current.campaignBreakdown.length ? (
                    analytics.audienceAnalytics.current.campaignBreakdown.map((campaign) => (
                      <div
                        key={campaign.label}
                        className={ANALYTICS_SOFT_CARD_CLASS}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {campaign.label}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              {campaign.source} / {campaign.medium} / {formatNumber(campaign.sessions)} session(s)
                            </p>
                          </div>
                          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                            {formatNumber(campaign.events)} events
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                      Campaign mix will appear as visitors arrive with UTM-tagged links.
                    </div>
                  )}
                </div>
              </section>

              <section className={ANALYTICS_PANEL_CLASS}>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Campaign Momentum</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Which tagged campaigns are growing or weakening across the comparison window.
                </p>

                <div className="mt-6 space-y-3">
                  {compare === 'previous' && analytics.audienceAnalytics.current.campaignTrends.length ? (
                    analytics.audienceAnalytics.current.campaignTrends.map((campaign) => (
                      <div
                        key={campaign.label}
                        className={ANALYTICS_SOFT_CARD_CLASS}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {campaign.label}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              Current {formatNumber(campaign.currentEvents)} / Previous {formatNumber(campaign.previousEvents)} events
                            </p>
                          </div>
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${getDeltaToneClass(
                              campaign.deltaEvents,
                              'higher_better'
                            )}`}
                          >
                            {formatDelta(campaign.deltaEvents)}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                      Enable `Previous Period` compare to see campaign momentum movement.
                    </div>
                  )}
                </div>
              </section>

              <section className={ANALYTICS_PANEL_CLASS}>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Time Zone Mix</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Geography-style audience signal based on browser-reported time zones.
                </p>

                <div className="mt-6 space-y-3">
                  {analytics.audienceAnalytics.current.timeZoneBreakdown.length ? (
                    analytics.audienceAnalytics.current.timeZoneBreakdown.map((timeZone) => (
                      <div
                        key={timeZone.timeZone}
                        className={ANALYTICS_SOFT_CARD_CLASS}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {timeZone.timeZone}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              {formatNumber(timeZone.sessions)} session(s)
                            </p>
                          </div>
                          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                            {formatNumber(timeZone.events)} events
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                      Time-zone signals will appear as fresh public visits are tracked with browser metadata.
                    </div>
                  )}
                </div>
              </section>

              <section className={ANALYTICS_PANEL_CLASS}>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Language Signals</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Browser language preferences from tracked readers across the selected time window.
                </p>

                <div className="mt-6 space-y-3">
                  {analytics.audienceAnalytics.current.languageBreakdown.length ? (
                    analytics.audienceAnalytics.current.languageBreakdown.map((language) => (
                      <div
                        key={language.language}
                        className={ANALYTICS_SOFT_CARD_CLASS}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {language.language}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              {formatNumber(language.sessions)} session(s)
                            </p>
                          </div>
                          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                            {formatNumber(language.events)} events
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                      Language signals will appear as fresh audience events are captured.
                    </div>
                  )}
                </div>
              </section>

              <section className={ANALYTICS_PANEL_CLASS}>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Country Signals</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Country hints from supported proxy or CDN headers when they are available.
                </p>

                <div className="mt-6 space-y-3">
                  {analytics.audienceAnalytics.current.countryBreakdown.length ? (
                    analytics.audienceAnalytics.current.countryBreakdown.map((country) => (
                      <div
                        key={country.country}
                        className={ANALYTICS_SOFT_CARD_CLASS}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {country.country}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              {formatNumber(country.sessions)} session(s)
                            </p>
                          </div>
                          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                            {formatNumber(country.events)} events
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                      Country signals depend on hosting headers and may appear later in production.
                    </div>
                  )}
                </div>
              </section>

              <section className={ANALYTICS_PANEL_CLASS}>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Section Leaders</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Which reader sections are generating the strongest page-view activity.
                </p>

                <div className="mt-6 space-y-3">
                  {analytics.audienceAnalytics.current.sectionBreakdown.length ? (
                    analytics.audienceAnalytics.current.sectionBreakdown.map((section) => (
                      <div
                        key={section.section}
                        className={ANALYTICS_SOFT_CARD_CLASS}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {section.section}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              {formatNumber(section.sessions)} session(s)
                            </p>
                          </div>
                          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                            {formatNumber(section.pageViews)} page views
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                      Section performance will appear as reader page-view data accumulates.
                    </div>
                  )}
                </div>
              </section>

              <section className={ANALYTICS_PANEL_CLASS}>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Conversion Leaders</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Which audience segments are turning sessions into popup or contact conversions most efficiently.
                </p>

                <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-4">
                  <AudienceConversionLeadersCard
                    title="By Device"
                    description="Session conversion performance by entry device class."
                    rows={analytics.audienceAnalytics.current.deviceConversionBreakdown}
                    trends={analytics.audienceAnalytics.current.deviceConversionTrends}
                    emptyMessage="Device conversion leaders will appear once tracked sessions begin converting."
                    showCompare={Boolean(analytics.audienceAnalytics.previous)}
                  />
                  <AudienceConversionLeadersCard
                    title="By Acquisition"
                    description="Which traffic channels are producing the highest conversion rates."
                    rows={analytics.audienceAnalytics.current.channelConversionBreakdown}
                    trends={analytics.audienceAnalytics.current.channelConversionTrends}
                    emptyMessage="Acquisition conversion leaders will appear once tracked sessions begin converting."
                    showCompare={Boolean(analytics.audienceAnalytics.previous)}
                  />
                  <AudienceConversionLeadersCard
                    title="By Campaign"
                    description="Tagged campaign performance by UTM campaign, source, and medium."
                    rows={analytics.audienceAnalytics.current.campaignConversionBreakdown.map((segment) => ({
                      ...segment,
                      detail: `${segment.source} / ${segment.medium}`,
                    }))}
                    trends={analytics.audienceAnalytics.current.campaignConversionTrends}
                    emptyMessage="Campaign conversion leaders will appear once UTM-tagged traffic starts converting."
                    showCompare={Boolean(analytics.audienceAnalytics.previous)}
                  />
                  <AudienceConversionLeadersCard
                    title="By Section"
                    description="Which entry sections are creating the strongest conversion momentum."
                    rows={analytics.audienceAnalytics.current.sectionConversionBreakdown}
                    trends={analytics.audienceAnalytics.current.sectionConversionTrends}
                    emptyMessage="Section conversion leaders will appear once tracked section sessions begin converting."
                    showCompare={Boolean(analytics.audienceAnalytics.previous)}
                  />
                </div>
              </section>

              <section className={ANALYTICS_PANEL_CLASS}>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Audience Path Performance</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Best and weakest converting entry paths, using the first tracked path signal in each audience session.
                </p>

                <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <AudienceConversionLeadersCard
                    title="Best Paths"
                    description="High-converting audience paths such as Search -> Politics or Direct -> Home."
                    rows={analytics.audienceAnalytics.current.pathConversionLeaders.map((path) => ({
                      ...path,
                      detail: `${path.device} / ${path.pageType}`,
                    }))}
                    trends={analytics.audienceAnalytics.current.pathConversionTrends}
                    emptyMessage="Path leaders will appear once enough session history is captured."
                    showCompare={Boolean(analytics.audienceAnalytics.previous)}
                  />
                  <AudienceConversionLeadersCard
                    title="Weakest Paths"
                    description="Paths that are attracting sessions but converting less efficiently right now."
                    rows={analytics.audienceAnalytics.current.pathConversionLaggards.map((path) => ({
                      ...path,
                      detail: `${path.device} / ${path.pageType}`,
                    }))}
                    trends={analytics.audienceAnalytics.current.pathConversionTrends}
                    emptyMessage="Path laggards will appear once enough session history is captured."
                    showCompare={Boolean(analytics.audienceAnalytics.previous)}
                  />
                </div>
              </section>

              <section className={ANALYTICS_PANEL_CLASS}>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Campaign Landing Performance</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Best and weakest landing pages for tagged campaigns, based on session-entry conversion performance.
                </p>

                <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <AudienceConversionLeadersCard
                    title="Best Campaign Landings"
                    description="Tagged campaign landings converting efficiently right now."
                    rows={analytics.audienceAnalytics.current.campaignLandingLeaders.map((landing) => ({
                      ...landing,
                      detail: `${landing.source} / ${landing.medium} / ${landing.page}`,
                    }))}
                    trends={[]}
                    emptyMessage="Campaign landing leaders will appear once tagged campaigns generate session conversions."
                    showCompare={false}
                  />
                  <AudienceConversionLeadersCard
                    title="Weak Campaign Landings"
                    description="Tagged campaign landings attracting sessions but converting weakly."
                    rows={analytics.audienceAnalytics.current.campaignLandingRisks.map((landing) => ({
                      ...landing,
                      detail: `${landing.source} / ${landing.medium} / ${landing.page}`,
                    }))}
                    trends={[]}
                    emptyMessage="Campaign landing risks will appear once tagged campaigns generate enough session history."
                    showCompare={false}
                  />
                </div>
              </section>

              <section className={ANALYTICS_PANEL_CLASS}>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Event Mix</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  The reader and lead-capture interactions currently being tracked across Lokswami.
                </p>

                <div className="mt-6 space-y-3">
                  {analytics.audienceAnalytics.current.eventBreakdown.length ? (
                    analytics.audienceAnalytics.current.eventBreakdown.map((event) => (
                      <div
                        key={event.event}
                        className={cx('flex items-center justify-between gap-3', ANALYTICS_SOFT_CARD_CLASS)}
                      >
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {event.event}
                        </p>
                        <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                          {formatNumber(event.count)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                      Event mix data is not available yet.
                    </div>
                  )}
                </div>
              </section>
            </section>
          </section>
        </>
      ) : null}

      {activeTab === 'newsroom_ops' ? (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(isSuperAdminView ? superAdminNewsroomMetrics : newsroomMetrics).map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </section>

          <AnalyticsLiveCharts
            initialSnapshot={liveChartsSnapshot}
            activeTab={activeTab}
            range={range}
            compare={compare}
          />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr,1fr]">
            <WorkflowList
              title="Filtered Workflow Queue"
              description="Live newsroom items filtered by the current signal focus and content type."
              items={filteredQueueItems.slice(0, isSuperAdminView ? 6 : 10)}
              emptyMessage="No workflow items match the current filters."
            />

            <section className={ANALYTICS_PANEL_CLASS}>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {isSuperAdminView ? 'Queue Snapshot' : 'Queue Composition'}
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                {isSuperAdminView
                  ? 'Keep the right side as a short summary and send deeper workflow work to the review queue.'
                  : 'The current review queue split across content types and release readiness.'}
              </p>

              {isSuperAdminView ? (
                <>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <span className={ANALYTICS_META_CHIP_CLASS}>
                      Articles {formatNumber(currentQueueMetrics.queueByType.article)}
                    </span>
                    <span className={ANALYTICS_META_CHIP_CLASS}>
                      Stories {formatNumber(currentQueueMetrics.queueByType.story)}
                    </span>
                    <span className={ANALYTICS_META_CHIP_CLASS}>
                      Videos {formatNumber(currentQueueMetrics.queueByType.video)}
                    </span>
                    <span className={ANALYTICS_META_CHIP_CLASS}>
                      Editions {formatNumber(currentQueueMetrics.queueByType.epaper)}
                    </span>
                  </div>

                  <div className="mt-5 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Release Status
                    </p>
                    <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-200">
                      {formatNumber(currentQueueMetrics.readyDecisions)} ready decisions and{' '}
                      {formatNumber(submittedCount)} newly submitted items are active in this window.
                    </p>
                  </div>
                </>
              ) : (
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      By Type
                    </p>
                    <div className="mt-3 space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
                      <p>Articles: {formatNumber(currentQueueMetrics.queueByType.article)}</p>
                      <p>Stories: {formatNumber(currentQueueMetrics.queueByType.story)}</p>
                      <p>Videos: {formatNumber(currentQueueMetrics.queueByType.video)}</p>
                      <p>Editions: {formatNumber(currentQueueMetrics.queueByType.epaper)}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      By Stage
                    </p>
                    <div className="mt-3 space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
                      <p>Submitted: {formatNumber(countItemsByStatuses(currentReviewItems, ['submitted']))}</p>
                      <p>Assigned: {formatNumber(countItemsByStatuses(currentReviewItems, ['assigned']))}</p>
                      <p>In review: {formatNumber(countItemsByStatuses(currentReviewItems, ['in_review']))}</p>
                      <p>Copy edit: {formatNumber(countItemsByStatuses(currentReviewItems, ['copy_edit']))}</p>
                      <p>Changes requested: {formatNumber(countItemsByStatuses(currentReviewItems, ['changes_requested']))}</p>
                      <p>Ready for approval: {formatNumber(countItemsByStatuses(currentReadyItems, ['ready_for_approval']))}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-5 space-y-3">
                <Link
                  href="/admin/review-queue"
                  className="inline-flex items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
                >
                  Open Review Queue
                </Link>
              </div>
            </section>
          </section>
        </>
      ) : null}

      {activeTab === 'epaper_ops' ? (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {epaperMetrics.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </section>

          <AnalyticsLiveCharts
            initialSnapshot={liveChartsSnapshot}
            activeTab={activeTab}
            range={range}
            compare={compare}
          />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr,1fr]">
            {focus === 'quality' ? (
              <section className={ANALYTICS_PANEL_CLASS}>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Quality Alerts</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Pages still flagged for OCR, hotspot, or QA cleanup during{' '}
                  {analytics.timeWindow.label.toLowerCase()}.
                </p>

                <div className="mt-6 space-y-3">
                  {currentLowQualityPages.length ? (
                    currentLowQualityPages.map((page) => (
                      <Link
                        key={`${page.epaperId}-${page.pageNumber}`}
                        href={page.editHref}
                        className={cx('block transition-colors hover:border-zinc-300/90 hover:bg-zinc-100/80 dark:hover:border-white/15 dark:hover:bg-white/[0.06]', ANALYTICS_SOFT_CARD_CLASS)}
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
                    <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                      No low-quality pages are active right now.
                    </div>
                  )}
                </div>
              </section>
            ) : (
              <section className={ANALYTICS_PANEL_CLASS}>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Blocked Editions</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Editions that still carry publish blockers and need production attention during{' '}
                  {analytics.timeWindow.label.toLowerCase()}.
                </p>

                <div className="mt-6 space-y-3">
                  {currentBlockedEditions.length ? (
                    currentBlockedEditions.map((edition) => (
                      <Link
                        key={edition.epaperId}
                        href={edition.editHref}
                        className={cx('block transition-colors hover:border-zinc-300/90 hover:bg-zinc-100/80 dark:hover:border-white/15 dark:hover:bg-white/[0.06]', ANALYTICS_SOFT_CARD_CLASS)}
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
                          {edition.blockers[0] || 'Edition still has active publish blockers.'}
                        </p>
                      </Link>
                    ))
                  ) : (
                    <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                      No editions are blocked right now.
                    </div>
                  )}
                </div>
              </section>
            )}

            <section className={ANALYTICS_PANEL_CLASS}>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Page QA Breakdown</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Flagged page quality and QA completion signals across the selected time window.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Watch
                  </p>
                  <p className="mt-2 text-2xl font-black text-amber-700">
                    {formatNumber(qualityWatchCount)}
                  </p>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Needs Recheck
                  </p>
                  <p className="mt-2 text-2xl font-black text-red-700">
                    {formatNumber(qualityNeedsRecheckCount)}
                  </p>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Pending QA
                  </p>
                  <p className="mt-2 text-2xl font-black text-zinc-900 dark:text-zinc-100">
                    {formatNumber(qualityPendingQaCount)}
                  </p>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Needs Attention
                  </p>
                  <p className="mt-2 text-2xl font-black text-orange-700">
                    {formatNumber(qualityNeedsAttentionCount)}
                  </p>
                </div>
              </div>
            </section>
          </section>
        </>
      ) : null}

      {activeTab === 'team' ? (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {teamMetrics.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </section>

          <AnalyticsLiveCharts
            initialSnapshot={liveChartsSnapshot}
            activeTab={activeTab}
            range={range}
            compare={compare}
          />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr,1.1fr]">
            <section className={ANALYTICS_PANEL_CLASS}>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Role Coverage</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Current admin-side role distribution and access alerts.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {(Object.entries(analytics.teamHealth.roleCounts) as Array<[string, number]>).map(
                  ([role, count]) => (
                    <span
                      key={role}
                      className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                    >
                      {formatUserRoleLabel(role)}: {formatNumber(count)}
                    </span>
                  )
                )}
              </div>

              <div className="mt-6 space-y-3">
                {analytics.teamHealth.alerts.length ? (
                  analytics.teamHealth.alerts.map((alert) => (
                    <div
                      key={alert}
                      className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm font-semibold text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                    >
                      {alert}
                    </div>
                  ))
                ) : (
                  <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                    No team-access alerts are active right now.
                  </div>
                )}
              </div>
            </section>

            <section className={ANALYTICS_PANEL_CLASS}>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Recent Sign-ins</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                The admin-side accounts seen during {analytics.timeWindow.label.toLowerCase()}.
              </p>

              <div className="mt-6 space-y-3">
                {currentRecentSignIns.length ? (
                  currentRecentSignIns.map((member) => (
                    <div
                      key={member.id || member.email}
                      className={ANALYTICS_SOFT_CARD_CLASS}
                    >
                      <div className="flex items-center justify-between gap-3">
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
                    </div>
                  ))
                ) : (
                  <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                    Team sign-in data is not available yet.
                  </div>
                )}
              </div>
            </section>
          </section>
        </>
      ) : null}

      {activeTab === 'growth' ? (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(isSuperAdminView ? superAdminGrowthMetrics : growthMetrics).map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </section>

          <AnalyticsLiveCharts
            initialSnapshot={liveChartsSnapshot}
            activeTab={activeTab}
            range={range}
            compare={compare}
          />

          <GrowthAnalyticsSections
            analytics={analytics}
            compare={compare}
            growthInsights={growthInsights}
            isCompact={isSuperAdminView}
          />
        </>
      ) : null}

      {activeTab === 'content' ? (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {contentMetrics
              .filter((metric) => {
                if (contentFilter === 'all') return true;
                const normalized = metric.label.toLowerCase();
                if (contentFilter === 'epaper') return normalized === 'e-papers';
                return normalized === `${contentFilter}s`;
              })
              .map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
          </section>

          <AnalyticsLiveCharts
            initialSnapshot={liveChartsSnapshot}
            activeTab={activeTab}
            range={range}
            compare={compare}
          />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <section className={ANALYTICS_PANEL_CLASS}>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Workflow Mix Trend</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Queue activity by content type compared with the previous reporting window.
              </p>

              <div className="mt-6 space-y-3">
                {compare === 'previous' && contentTypeTrendRows.length ? (
                  contentTypeTrendRows
                    .filter((row) => {
                      if (contentFilter === 'all') return true;
                      if (contentFilter === 'epaper') return row.label === 'E-Papers';
                      return row.label.toLowerCase() === `${contentFilter}s`;
                    })
                    .map((row) => (
                    <div
                      key={row.label}
                      className={ANALYTICS_SOFT_CARD_CLASS}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {row.label}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            Current {formatNumber(row.current)} / Previous {formatNumber(row.previous)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getDeltaToneClass(
                            row.delta,
                            'higher_better'
                          )}`}
                        >
                          {formatDelta(row.delta)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                    Enable `Previous Period` compare to see workflow trend movement by content type.
                  </div>
                )}
              </div>
            </section>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr,1fr]">
            {(contentFilter === 'all' || contentFilter === 'article') ? (
              <section className={ANALYTICS_PANEL_CLASS}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Popular Articles</h2>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                      Top-performing articles from the current internal snapshot.
                    </p>
                  </div>
                  <Link href="/admin/articles" className="text-sm font-semibold text-red-600 hover:text-red-500">
                    Open Articles
                  </Link>
                </div>

                <div className="mt-6 space-y-3">
                  {analytics.dashboard.popularArticles.length ? (
                    analytics.dashboard.popularArticles.map((article) => (
                      <Link
                        key={article.id}
                        href={`/admin/articles/${encodeURIComponent(article.id)}/edit`}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {article.title}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {article.category} / {article.author}
                          </p>
                        </div>
                        <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
                          <p>{formatNumber(article.views)} views</p>
                          <p className="mt-1">{formatUiDate(article.publishedAt, article.publishedAt)}</p>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                      No popular article data is available yet.
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            <section className={ANALYTICS_PANEL_CLASS}>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Content Snapshot</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                A focused read on the selected content area and the current queue mix.
              </p>

              <div className="mt-6 space-y-3">
                {(contentFilter === 'all' || contentFilter === 'article') &&
                analytics.dashboard.recentArticles.length ? (
                  <div className={ANALYTICS_SOFT_CARD_CLASS}>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent Articles</p>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                      {formatNumber(analytics.dashboard.recentArticles.length)} recent items in the article output snapshot.
                    </p>
                  </div>
                ) : null}

                {(contentFilter === 'all' || contentFilter === 'video') &&
                analytics.dashboard.recentVideos.length ? (
                  <div className={ANALYTICS_SOFT_CARD_CLASS}>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent Videos</p>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                      {formatNumber(analytics.dashboard.recentVideos.length)} video items in the latest published snapshot.
                    </p>
                  </div>
                ) : null}

                {contentFilter === 'all' || contentFilter === 'story' ? (
                  <div className={ANALYTICS_SOFT_CARD_CLASS}>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Story Queue Presence</p>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                      {formatNumber(currentQueueMetrics.queueByType.story)} story item(s) were represented in the mixed newsroom queue during{' '}
                      {analytics.timeWindow.label.toLowerCase()}.
                    </p>
                  </div>
                ) : null}

                {contentFilter === 'all' || contentFilter === 'epaper' ? (
                  <div className={ANALYTICS_SOFT_CARD_CLASS}>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Edition Inventory</p>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                      {formatNumber(analytics.contentInventory.epapers)} edition(s) stored, with {formatNumber(currentQueueMetrics.queueByType.epaper)} showing workflow activity during{' '}
                      {analytics.timeWindow.label.toLowerCase()}.
                    </p>
                  </div>
                ) : null}
              </div>
            </section>
          </section>
        </>
      ) : null}

      {activeTab === 'system_health' ? (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(isSuperAdminView ? superAdminSystemMetrics : systemMetrics).map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </section>

          <AnalyticsLiveCharts
            initialSnapshot={liveChartsSnapshot}
            activeTab={activeTab}
            range={range}
            compare={compare}
          />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr,1.1fr]">
            <section className={ANALYTICS_PANEL_CLASS}>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Service Readiness</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Runtime-level readiness across database, AI, shared TTS, and workflow operations.
              </p>

              <div className="mt-6 space-y-3">
                {analytics.systemHealth.services.map((service) => (
                  <div
                    key={service.id}
                    className={ANALYTICS_SOFT_CARD_CLASS}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {service.label}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {service.summary}
                        </p>
                      </div>
                      <ServiceStatusPill status={service.status} />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                      {service.detail}
                    </p>
                    {service.href ? (
                      <div className="mt-4">
                        <Link
                          href={service.href}
                          className="text-sm font-semibold text-red-600 hover:text-red-500"
                        >
                          Open Related Surface
                        </Link>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-6">
              <section className={ANALYTICS_PANEL_CLASS}>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Platform Risks</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Leadership-facing issues that may affect stability, release flow, or service availability.
                </p>

                <div className="mt-6 space-y-3">
                  {analytics.systemHealth.risks.length ? (
                    analytics.systemHealth.risks.map((risk) => (
                      <div
                        key={risk}
                        className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm font-semibold text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                      >
                        {risk}
                      </div>
                    ))
                  ) : (
                    <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                      No active platform risks are being flagged right now.
                    </div>
                  )}
                </div>
              </section>

              {isSuperAdminView ? (
                <details className="rounded-[24px] border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface)] p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-[color:var(--admin-shell-text)]">
                    Runtime Details
                  </summary>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {analytics.systemHealth.runtimeSignals.map((signal) => (
                      <RuntimeSignalPill
                        key={signal.label}
                        label={signal.label}
                        value={signal.value}
                        tone={signal.tone}
                      />
                    ))}
                  </div>
                </details>
              ) : (
                <section className={ANALYTICS_PANEL_CLASS}>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Runtime Signals</h2>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    Quick configuration and storage signals for the current platform runtime.
                  </p>

                  <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {analytics.systemHealth.runtimeSignals.map((signal) => (
                      <RuntimeSignalPill
                        key={signal.label}
                        label={signal.label}
                        value={signal.value}
                        tone={signal.tone}
                      />
                    ))}
                  </div>
                </section>
              )}
            </section>
          </section>

          {isSuperAdminView ? (
            <details className={ANALYTICS_PANEL_CLASS}>
              <summary className="cursor-pointer text-sm font-semibold text-[color:var(--admin-shell-text)]">
                Recent TTS Failures
              </summary>

              <div className="mt-4 space-y-3">
                {analytics.systemHealth.recentFailures.length ? (
                  analytics.systemHealth.recentFailures.map((failure) => (
                    <div
                      key={failure.id}
                      className={ANALYTICS_SOFT_CARD_CLASS}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {failure.message}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {formatStatusLabel(failure.action)} / {formatContentTypeLabel(failure.sourceType)} /{' '}
                            {formatStatusLabel(failure.variant)}
                          </p>
                        </div>
                        <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
                          {formatUiDate(failure.createdAt, failure.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                    No TTS failures were recorded in this time window.
                  </div>
                )}
              </div>
            </details>
          ) : (
            <section className={ANALYTICS_PANEL_CLASS}>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Recent TTS Failures</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                The latest failure events captured for the shared TTS pipeline in the selected time window.
              </p>

              <div className="mt-6 space-y-3">
                {analytics.systemHealth.recentFailures.length ? (
                  analytics.systemHealth.recentFailures.map((failure) => (
                    <div
                      key={failure.id}
                      className={ANALYTICS_SOFT_CARD_CLASS}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {failure.message}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {formatStatusLabel(failure.action)} / {formatContentTypeLabel(failure.sourceType)} /{' '}
                            {formatStatusLabel(failure.variant)}
                          </p>
                        </div>
                        <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
                          {formatUiDate(failure.createdAt, failure.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={ANALYTICS_EMPTY_STATE_CLASS}>
                    No TTS failures were recorded in this time window.
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}

