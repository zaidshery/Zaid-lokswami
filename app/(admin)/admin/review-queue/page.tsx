import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  ListFilter,
  MessageSquare,
  Newspaper,
  Video,
} from 'lucide-react';
import { getAdminSession } from '@/lib/auth/admin';
import {
  getReviewQueueOverview,
  REVIEW_QUEUE_EPAPER_STATUSES,
  REVIEW_QUEUE_STATUSES,
} from '@/lib/admin/articleWorkflowOverview';
import type {
  ReviewQueueAssignmentFilter,
  WorkflowContentKey,
} from '@/lib/admin/articleWorkflowOverview';
import { getAdminDashboardData } from '@/lib/admin/dashboard';
import { getEpaperInsights } from '@/lib/admin/epaperInsights';
import { canViewPage } from '@/lib/auth/permissions';
import { formatUserRoleLabel } from '@/lib/auth/roles';
import { formatUiDate } from '@/lib/utils/dateFormat';
import formatNumber from '@/lib/utils/formatNumber';
import {
  isEpaperProductionStatus,
  isWorkflowPriority,
  isWorkflowStatus,
  WORKFLOW_PRIORITIES,
  type EPaperProductionStatus,
  type WorkflowPriority,
  type WorkflowStatus,
} from '@/lib/workflow/types';
import {
  CmsCollectionPage,
  CMS_COLLECTION_EMPTY_STATE_CLASS as EMPTY_STATE_CLASS,
  CMS_COLLECTION_PANEL_CLASS as PANEL_CLASS,
  CMS_COLLECTION_SOFT_CARD_CLASS as SOFT_CARD_CLASS,
} from '@/components/admin/CmsCollectionLayout';
import {
  CmsWorkflowPriorityBadge,
  CmsWorkflowStatusBadge,
  formatWorkflowContentTypeLabel,
  formatWorkflowPriorityLabel,
  formatWorkflowStatusLabel,
} from '@/components/admin/CmsWorkflowStatusBadge';

type QueueCard = {
  title: string;
  description: string;
  href: string;
  count: number;
  icon: typeof FileText;
  tone: string;
};

type ReviewQueueStatusFilter = WorkflowStatus | EPaperProductionStatus;

const CONTENT_TYPE_FILTERS: Array<{ id: 'all' | WorkflowContentKey; label: string }> = [
  { id: 'all', label: 'All content' },
  { id: 'article', label: 'Articles' },
  { id: 'story', label: 'Stories' },
  { id: 'video', label: 'Videos' },
  { id: 'epaper', label: 'E-Papers' },
];

const STATUS_FILTERS: Array<{ id: 'all' | ReviewQueueStatusFilter; label: string }> = [
  { id: 'all', label: 'All statuses' },
  ...REVIEW_QUEUE_STATUSES.map((status) => ({
    id: status,
    label: formatWorkflowStatusLabel(status),
  })),
  ...REVIEW_QUEUE_EPAPER_STATUSES.map((status) => ({
    id: status,
    label: formatWorkflowStatusLabel(status),
  })),
];

const PRIORITY_FILTERS: Array<{ id: 'all' | WorkflowPriority; label: string }> = [
  { id: 'all', label: 'All priorities' },
  ...WORKFLOW_PRIORITIES.map((priority) => ({
    id: priority,
    label: formatWorkflowPriorityLabel(priority),
  })),
];

const ASSIGNMENT_FILTERS: Array<{ id: 'all' | ReviewQueueAssignmentFilter; label: string }> = [
  { id: 'all', label: 'All assignees' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'unassigned', label: 'Unassigned' },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseContentTypeFilter(value: string | undefined): WorkflowContentKey | undefined {
  if (value === 'article' || value === 'story' || value === 'video' || value === 'epaper') {
    return value;
  }
  return undefined;
}

function parseStatusFilter(value: string | undefined): ReviewQueueStatusFilter | undefined {
  if (isWorkflowStatus(value) && REVIEW_QUEUE_STATUSES.includes(value)) {
    return value;
  }
  if (isEpaperProductionStatus(value) && REVIEW_QUEUE_EPAPER_STATUSES.includes(value)) {
    return value;
  }
  return undefined;
}

function parsePriorityFilter(value: string | undefined): WorkflowPriority | undefined {
  return isWorkflowPriority(value) ? value : undefined;
}

function parseAssignmentFilter(value: string | undefined): ReviewQueueAssignmentFilter | undefined {
  if (value === 'assigned' || value === 'unassigned') {
    return value;
  }
  return undefined;
}

function buildReviewQueueHref(filters: {
  contentType?: WorkflowContentKey;
  status?: ReviewQueueStatusFilter;
  priority?: WorkflowPriority;
  assignment?: ReviewQueueAssignmentFilter;
}) {
  const params = new URLSearchParams();
  if (filters.contentType) params.set('type', filters.contentType);
  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.assignment) params.set('assignment', filters.assignment);
  const query = params.toString();
  return query ? `/admin/review-queue?${query}` : '/admin/review-queue';
}

function filterChipClass(isActive: boolean) {
  return cx(
    'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
    isActive
      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:bg-zinc-800'
  );
}

const FILTER_ROW_CLASS =
  'mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

export default async function AdminReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const admin = await getAdminSession();
  if (!admin) {
    redirect('/signin?redirect=/admin/review-queue');
  }
  if (!canViewPage(admin.role, 'review_queue')) {
    redirect('/admin');
  }

  const typeFilter = parseContentTypeFilter(getSearchParamValue(resolvedSearchParams.type));
  const statusFilter = parseStatusFilter(getSearchParamValue(resolvedSearchParams.status));
  const priorityFilter = parsePriorityFilter(getSearchParamValue(resolvedSearchParams.priority));
  const assignmentFilter = parseAssignmentFilter(getSearchParamValue(resolvedSearchParams.assignment));
  const activeFilterCount = [typeFilter, statusFilter, priorityFilter, assignmentFilter].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  const dashboard = await getAdminDashboardData();
  const reviewQueue = await getReviewQueueOverview({
    maxItems: hasActiveFilters ? null : 12,
    filters: {
      contentType: typeFilter,
      status: statusFilter,
      priority: priorityFilter,
      assignment: assignmentFilter,
    },
  });
  const epaperInsights = await getEpaperInsights();
  const visibleLowQualityPages = epaperInsights.lowQualityPages.slice(0, 5);
  const visibleBlockedEditions = epaperInsights.blockedEditions.slice(0, 6);

  const queueCards: QueueCard[] = [
    {
      title: 'Article Queue',
      description: 'Article submissions and review-stage pieces in the desk.',
      href: '/admin/articles',
      count: reviewQueue.contentCounts.article || 0,
      icon: FileText,
      tone: 'bg-blue-500/10 text-blue-600',
    },
    {
      title: 'Story Queue',
      description: 'Visual stories already flowing through the same workflow states.',
      href: '/admin/stories',
      count: reviewQueue.contentCounts.story || 0,
      icon: MessageSquare,
      tone: 'bg-rose-500/10 text-rose-600',
    },
    {
      title: 'Video Queue',
      description: 'Video reviews, copy work, and ready-to-publish video items.',
      href: '/admin/videos',
      count: reviewQueue.contentCounts.video || 0,
      icon: Video,
      tone: 'bg-violet-500/10 text-violet-600',
    },
    {
      title: 'E-Paper Desk',
      description: 'Edition operations already flowing through production stages and publish readiness.',
      href: '/admin/epapers',
      count: reviewQueue.contentCounts.epaper || 0,
      icon: Newspaper,
      tone: 'bg-orange-500/10 text-orange-600',
    },
    {
      title: 'Inbox Triage',
      description: 'Reader contact flow stays visible here as part of desk operations.',
      href: '/admin/contact-messages',
      count: dashboard.inbox.new,
      icon: MessageSquare,
      tone: 'bg-emerald-500/10 text-emerald-600',
    },
  ];

  const submittedCount = reviewQueue.counts.submitted || 0;
  const inReviewCount = (reviewQueue.counts.in_review || 0) + (reviewQueue.counts.copy_edit || 0);
  const editionReadyCount = reviewQueue.productionCounts.ready_to_publish || 0;
  const qaIssueCount = epaperInsights.lowQualityPages.length;
  const deskStats = [
    {
      label: 'Submitted',
      value: submittedCount,
      note: 'Awaiting desk review',
      icon: FileText,
    },
    {
      label: 'In Review',
      value: inReviewCount,
      note: 'Editor or copy pass',
      icon: ListFilter,
    },
    {
      label: 'Edition Ready',
      value: editionReadyCount,
      note: 'Cleared for publishing',
      icon: CheckCircle2,
    },
  ];

  return (
    <CmsCollectionPage className="space-y-5 sm:space-y-6">
      <section className="admin-shell-surface-strong rounded-[20px] p-4 sm:rounded-[28px] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-red-600 dark:text-red-300">
              {formatUserRoleLabel(admin.role)}
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-[color:var(--admin-shell-text)] sm:text-4xl">
              Review Queue
            </h1>
            <p className="mt-2 text-sm leading-6 text-[color:var(--admin-shell-text-muted)]">
              Active editorial work, production QA, and publishing blockers in one scan-friendly desk view.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/articles"
              className="admin-shell-toolbar-btn inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold"
            >
              Articles
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/admin/epapers"
              className="admin-shell-toolbar-btn inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold"
            >
              E-Paper Desk
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Queue items', reviewQueue.items.length],
            ['QA page issues', qaIssueCount],
            ['Blocked editions', epaperInsights.blockedEditions.length],
            ['Inbox new', dashboard.inbox.new],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-[16px] border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface-muted)] px-3 py-3"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-shell-text-muted)]">
                {label}
              </p>
              <p className="mt-1 text-2xl font-black text-[color:var(--admin-shell-text)]">
                {formatNumber(Number(value))}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {queueCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group admin-shell-surface rounded-[16px] p-3 transition-all hover:-translate-y-0.5 hover:border-red-400/25 sm:p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`inline-flex rounded-xl p-2 ${card.tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-2xl font-black text-[color:var(--admin-shell-text)]">
                  {formatNumber(card.count)}
                </p>
              </div>
              <h2 className="mt-3 text-sm font-bold leading-5 text-[color:var(--admin-shell-text)]">
                {card.title}
              </h2>
              <p className="mt-1 hidden text-xs leading-5 text-[color:var(--admin-shell-text-muted)] sm:line-clamp-2">
                {card.description}
              </p>
              <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-red-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-red-300">
                Open
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <section className={PANEL_CLASS}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-[color:var(--admin-shell-text)]">
                  Live Newsroom Queue
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-[color:var(--admin-shell-text-muted)]">
                  Items waiting on editorial, copy, production, or publish desk action.
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
                  {hasActiveFilters ? `${activeFilterCount} active` : 'All items'}
                </span>
                {hasActiveFilters ? (
                  <Link
                    href="/admin/review-queue"
                    className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Clear
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="mt-4 rounded-[18px] border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface-muted)] p-3">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-shell-text-muted)]">
                <ListFilter className="h-4 w-4" />
                Filters
              </div>
              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.5fr]">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--admin-shell-text-muted)]">
                    Content
                  </p>
                  <div className={FILTER_ROW_CLASS}>
                    {CONTENT_TYPE_FILTERS.map((filter) => {
                      const nextContentType = filter.id === 'all' ? undefined : filter.id;
                      const isActive = (typeFilter || 'all') === filter.id;
                      return (
                        <Link
                          key={filter.id}
                          href={buildReviewQueueHref({
                            contentType: nextContentType,
                            status: statusFilter,
                            priority: priorityFilter,
                            assignment: assignmentFilter,
                          })}
                          className={filterChipClass(isActive)}
                        >
                          {filter.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--admin-shell-text-muted)]">
                    Status
                  </p>
                  <div className={FILTER_ROW_CLASS}>
                    {STATUS_FILTERS.map((filter) => {
                      const nextStatus = filter.id === 'all' ? undefined : filter.id;
                      const isActive = (statusFilter || 'all') === filter.id;
                      return (
                        <Link
                          key={filter.id}
                          href={buildReviewQueueHref({
                            contentType: typeFilter,
                            status: nextStatus,
                            priority: priorityFilter,
                            assignment: assignmentFilter,
                          })}
                          className={filterChipClass(isActive)}
                        >
                          {filter.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--admin-shell-text-muted)]">
                    Priority
                  </p>
                  <div className={FILTER_ROW_CLASS}>
                    {PRIORITY_FILTERS.map((filter) => {
                      const nextPriority = filter.id === 'all' ? undefined : filter.id;
                      const isActive = (priorityFilter || 'all') === filter.id;
                      return (
                        <Link
                          key={filter.id}
                          href={buildReviewQueueHref({
                            contentType: typeFilter,
                            status: statusFilter,
                            priority: nextPriority,
                            assignment: assignmentFilter,
                          })}
                          className={filterChipClass(isActive)}
                        >
                          {filter.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--admin-shell-text-muted)]">
                    Assignment
                  </p>
                  <div className={FILTER_ROW_CLASS}>
                    {ASSIGNMENT_FILTERS.map((filter) => {
                      const nextAssignment = filter.id === 'all' ? undefined : filter.id;
                      const isActive = (assignmentFilter || 'all') === filter.id;
                      return (
                        <Link
                          key={filter.id}
                          href={buildReviewQueueHref({
                            contentType: typeFilter,
                            status: statusFilter,
                            priority: priorityFilter,
                            assignment: nextAssignment,
                          })}
                          className={filterChipClass(isActive)}
                        >
                          {filter.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-[18px] border border-[color:var(--admin-shell-border)]">
              <div className="hidden grid-cols-[minmax(0,1.5fr)_0.55fr_0.7fr_0.7fr_auto] gap-4 border-b border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface-muted)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--admin-shell-text-muted)] lg:grid">
                <span>Item</span>
                <span>Type</span>
                <span>Owner</span>
                <span>Updated</span>
                <span className="text-right">State</span>
              </div>

              <div className="divide-y divide-[color:var(--admin-shell-border)]">
                {reviewQueue.items.length ? (
                  reviewQueue.items.map((item) => (
                    <Link
                      key={`${item.contentType}-${item.id}`}
                      href={item.editHref}
                      className="grid gap-3 px-3 py-3 text-sm transition-colors hover:bg-[color:var(--admin-shell-surface-muted)] sm:px-4 lg:grid-cols-[minmax(0,1.5fr)_0.55fr_0.7fr_0.7fr_auto] lg:items-center lg:gap-4"
                    >
                      <div className="min-w-0">
                        <p className="line-clamp-2 font-semibold leading-5 text-[color:var(--admin-shell-text)]">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-[color:var(--admin-shell-text-muted)]">
                          {item.category} / {item.author}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-[color:var(--admin-shell-text-muted)]">
                        {formatWorkflowContentTypeLabel(item.contentType)}
                      </span>
                      <span className="text-xs text-[color:var(--admin-shell-text-muted)]">
                        {item.assignedToName || 'Unassigned'}
                      </span>
                      <span className="text-xs text-[color:var(--admin-shell-text-muted)]">
                        {formatUiDate(item.updatedAt, item.updatedAt)}
                      </span>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <CmsWorkflowStatusBadge status={item.status} />
                        {item.priority ? <CmsWorkflowPriorityBadge priority={item.priority} /> : null}
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="p-3 sm:p-4">
                    <div className={EMPTY_STATE_CLASS}>
                      No live workflow items are waiting in the queue right now.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className={PANEL_CLASS}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-[color:var(--admin-shell-text)]">
                  E-Paper QA Watchlist
                </h2>
                <p className="mt-1 text-sm leading-6 text-[color:var(--admin-shell-text-muted)]">
                  Pages with weak OCR, missing hotspots, or open QA issues that need a desk pass.
                </p>
              </div>
              <Link
                href="/admin/epapers"
                className="admin-shell-toolbar-btn inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold"
              >
                Open Desk
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-4 space-y-2">
              {epaperInsights.lowQualityPages.length ? (
                visibleLowQualityPages.map((page) => (
                  <Link
                    key={`${page.epaperId}-${page.pageNumber}`}
                    href={page.editHref}
                    className={cx(
                      'grid gap-3 transition-colors hover:border-zinc-300/90 hover:bg-zinc-100/80 dark:hover:border-white/15 dark:hover:bg-white/[0.06] md:grid-cols-[minmax(0,1fr)_auto] md:items-center',
                      SOFT_CARD_CLASS
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[color:var(--admin-shell-text)]">
                        {page.epaperTitle} / Page {page.pageNumber}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--admin-shell-text-muted)]">
                        {page.cityName} / {page.issueSummary}
                      </p>
                      <p className="mt-2 text-xs text-[color:var(--admin-shell-text-muted)]">
                        Updated {formatUiDate(page.updatedAt, page.updatedAt)} / Page QA: {formatWorkflowStatusLabel(page.reviewStatus)}
                      </p>
                    </div>
                    <span className="w-fit rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">
                      {page.qualityLabel}
                    </span>
                  </Link>
                ))
              ) : (
                <div className={EMPTY_STATE_CLASS}>
                  No low-quality e-paper pages are active right now.
                </div>
              )}
              {epaperInsights.lowQualityPages.length > visibleLowQualityPages.length ? (
                <Link
                  href="/admin/epapers"
                  className="block rounded-2xl border border-dashed border-[color:var(--admin-shell-border)] px-4 py-3 text-sm font-semibold text-[color:var(--admin-shell-text-muted)] hover:text-[color:var(--admin-shell-text)]"
                >
                  +{formatNumber(epaperInsights.lowQualityPages.length - visibleLowQualityPages.length)} more page issues in E-Paper Desk
                </Link>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <section className={PANEL_CLASS}>
            <h2 className="text-lg font-bold text-[color:var(--admin-shell-text)]">
              Desk Snapshot
            </h2>
            <div className="mt-4 divide-y divide-[color:var(--admin-shell-border)]">
              {deskStats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[color:var(--admin-shell-text)]">
                          {stat.label}
                        </p>
                        <p className="text-xs text-[color:var(--admin-shell-text-muted)]">
                          {stat.note}
                        </p>
                      </div>
                    </div>
                    <p className="text-2xl font-black text-[color:var(--admin-shell-text)]">
                      {formatNumber(stat.value)}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className={PANEL_CLASS}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-bold text-[color:var(--admin-shell-text)]">
                Publish Blockers
              </h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-[color:var(--admin-shell-text-muted)]">
              Editions blocked by page QA, missing stories, or extraction coverage.
            </p>

            <div className="mt-4 space-y-2">
              {epaperInsights.blockedEditions.length ? (
                visibleBlockedEditions.map((edition) => (
                  <Link
                    key={edition.epaperId}
                    href={edition.editHref}
                    className={cx(
                      'block transition-colors hover:border-zinc-300/90 hover:bg-zinc-100/80 dark:hover:border-white/15 dark:hover:bg-white/[0.06]',
                      SOFT_CARD_CLASS
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold text-[color:var(--admin-shell-text)]">
                          {edition.title}
                        </p>
                        <p className="mt-1 text-xs text-[color:var(--admin-shell-text-muted)]">
                          {edition.cityName} / {formatWorkflowStatusLabel(edition.productionStatus)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">
                        {edition.blockerCount}
                      </span>
                    </div>
                    <ul className="mt-3 space-y-1 text-xs text-[color:var(--admin-shell-text-muted)]">
                      {edition.blockers.slice(0, 3).map((blocker) => (
                        <li key={blocker}>- {blocker}</li>
                      ))}
                    </ul>
                  </Link>
                ))
              ) : (
                <div className="rounded-[18px] border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="h-4 w-4" />
                    No editions are blocked right now.
                  </div>
                </div>
              )}
              {epaperInsights.blockedEditions.length > visibleBlockedEditions.length ? (
                <Link
                  href="/admin/epapers"
                  className="block rounded-2xl border border-dashed border-[color:var(--admin-shell-border)] px-4 py-3 text-sm font-semibold text-[color:var(--admin-shell-text-muted)] hover:text-[color:var(--admin-shell-text)]"
                >
                  +{formatNumber(epaperInsights.blockedEditions.length - visibleBlockedEditions.length)} more blocked editions
                </Link>
              ) : null}
            </div>
          </section>
        </aside>
      </section>
    </CmsCollectionPage>
  );
}
