import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, FileText, MessageSquare, Newspaper, Video } from 'lucide-react';
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
  CmsCollectionHero,
  CmsCollectionPage,
  CMS_COLLECTION_EMPTY_STATE_CLASS as EMPTY_STATE_CLASS,
  CMS_COLLECTION_META_CHIP_CLASS as META_CHIP_CLASS,
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
    'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:px-4 sm:text-sm',
    isActive
      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:bg-zinc-800'
  );
}

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

  return (
    <CmsCollectionPage className="space-y-6">
      <CmsCollectionHero
        accent="red"
        eyebrow={formatUserRoleLabel(admin.role)}
        title="Review Queue"
        description="See active review work across articles, stories, videos, inbox triage, and e-paper production in one place."
        meta={
          <>
            <div className={META_CHIP_CLASS}>
              <span>Queue Items</span>
              <strong className="text-[color:var(--admin-shell-text)]">
                {formatNumber(reviewQueue.items.length)}
              </strong>
            </div>
            <div className={META_CHIP_CLASS}>
              <span>Blocked Editions</span>
              <strong className="text-[color:var(--admin-shell-text)]">
                {formatNumber(epaperInsights.blockedEditions.length)}
              </strong>
            </div>
            <div className={META_CHIP_CLASS}>
              <span>Inbox New</span>
              <strong className="text-[color:var(--admin-shell-text)]">
                {formatNumber(dashboard.inbox.new)}
              </strong>
            </div>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {queueCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="admin-shell-surface-strong rounded-[18px] p-3 transition-all hover:-translate-y-0.5 sm:rounded-[28px] sm:p-5"
            >
              <div className="flex h-full flex-col justify-between gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className={`inline-flex rounded-2xl p-2.5 sm:p-3 ${card.tone}`}>
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <p className="text-2xl font-black text-[color:var(--admin-shell-text)] sm:text-3xl">
                    {formatNumber(card.count)}
                  </p>
                </div>
                <div>
                  <h2 className="text-sm font-bold leading-5 text-[color:var(--admin-shell-text)] sm:text-base">
                    {card.title}
                  </h2>
                  <p className="mt-2 hidden text-sm leading-6 text-[color:var(--admin-shell-text-muted)] sm:block">
                    {card.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      <section className={PANEL_CLASS}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-[color:var(--admin-shell-text)]">
              Live Newsroom Queue
            </h2>
            <p className="mt-1 text-sm text-[color:var(--admin-shell-text-muted)]">
              Mixed workflow and production items currently waiting on editorial or production desk action.
            </p>
          </div>

          <div className="flex items-center gap-2">
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

        <div className="mt-5 border-t border-[color:var(--admin-shell-border)] pt-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--admin-shell-text-muted)]">
                Content
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
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
              <div className="mt-2 flex flex-wrap gap-2">
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
              <div className="mt-2 flex flex-wrap gap-2">
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
              <div className="mt-2 flex flex-wrap gap-2">
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

        <div className="mt-6 space-y-3">
          {reviewQueue.items.length ? (
            reviewQueue.items.map((item) => (
              <Link
                key={`${item.contentType}-${item.id}`}
                href={item.editHref}
                className={cx(
                  'flex flex-col gap-3 transition-colors hover:border-zinc-300/90 hover:bg-zinc-100/80 dark:hover:border-white/15 dark:hover:bg-white/[0.06]',
                  SOFT_CARD_CLASS
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[color:var(--admin-shell-text)]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-[color:var(--admin-shell-text-muted)]">
                      {item.category} / {item.author} / {formatWorkflowContentTypeLabel(item.contentType)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <CmsWorkflowStatusBadge status={item.status} />
                    {item.priority ? <CmsWorkflowPriorityBadge priority={item.priority} /> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-[color:var(--admin-shell-text-muted)]">
                  <span>Updated {formatUiDate(item.updatedAt, item.updatedAt)}</span>
                  {item.assignedToName ? <span>Assignee: {item.assignedToName}</span> : null}
                  {item.createdByName ? <span>Created by: {item.createdByName}</span> : null}
                </div>
              </Link>
            ))
          ) : (
            <div className={EMPTY_STATE_CLASS}>
              No live workflow items are waiting in the queue right now.
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="admin-shell-surface rounded-3xl p-6 shadow-sm">
          <p className="text-sm font-medium text-[color:var(--admin-shell-text-muted)]">Submitted</p>
          <p className="mt-3 text-3xl font-black text-[color:var(--admin-shell-text)]">
            {formatNumber(reviewQueue.counts.submitted || 0)}
          </p>
          <p className="mt-4 text-sm text-[color:var(--admin-shell-text-muted)]">
            Reporter-created items waiting for assignment or review.
          </p>
        </div>
        <div className="admin-shell-surface rounded-3xl p-6 shadow-sm">
          <p className="text-sm font-medium text-[color:var(--admin-shell-text-muted)]">In Review</p>
          <p className="mt-3 text-3xl font-black text-[color:var(--admin-shell-text)]">
            {formatNumber(
              (reviewQueue.counts.in_review || 0) + (reviewQueue.counts.copy_edit || 0)
            )}
          </p>
          <p className="mt-4 text-sm text-[color:var(--admin-shell-text-muted)]">
            Content currently moving through editor and copy workflows.
          </p>
        </div>
        <div className="admin-shell-surface rounded-3xl p-6 shadow-sm">
          <p className="text-sm font-medium text-[color:var(--admin-shell-text-muted)]">Edition QA / Ready</p>
          <p className="mt-3 text-3xl font-black text-[color:var(--admin-shell-text)]">
            {formatNumber(
              (reviewQueue.productionCounts.qa_review || 0) +
                (reviewQueue.productionCounts.ready_to_publish || 0)
            )}
          </p>
          <p className="mt-4 text-sm text-[color:var(--admin-shell-text-muted)]">
            E-paper editions in final QA or cleared for publish decisions.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className={PANEL_CLASS}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[color:var(--admin-shell-text)]">
                Low-Quality E-Paper Pages
              </h2>
              <p className="mt-1 text-sm text-[color:var(--admin-shell-text-muted)]">
                Pages with weak OCR, missing hotspots, or open QA issues that need a desk pass.
              </p>
            </div>
            <Link href="/admin/epapers" className="admin-shell-toolbar-btn rounded-full px-3 py-2 text-sm font-semibold">
              Open E-Paper Desk
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            {epaperInsights.lowQualityPages.length ? (
              visibleLowQualityPages.map((page) => (
                <Link
                  key={`${page.epaperId}-${page.pageNumber}`}
                  href={page.editHref}
                  className={cx(
                    'flex flex-col gap-3 transition-colors hover:border-zinc-300/90 hover:bg-zinc-100/80 dark:hover:border-white/15 dark:hover:bg-white/[0.06]',
                    SOFT_CARD_CLASS
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[color:var(--admin-shell-text)]">
                        {page.epaperTitle} / Page {page.pageNumber}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--admin-shell-text-muted)]">
                        {page.cityName} / {page.issueSummary}
                      </p>
                    </div>
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">
                      {page.qualityLabel}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-[color:var(--admin-shell-text-muted)]">
                    <span>Updated {formatUiDate(page.updatedAt, page.updatedAt)}</span>
                    <span>Page QA: {formatWorkflowStatusLabel(page.reviewStatus)}</span>
                    {page.reviewedByName ? <span>Reviewer: {page.reviewedByName}</span> : null}
                  </div>
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
        </div>

        <div className={PANEL_CLASS}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h2 className="text-xl font-bold text-[color:var(--admin-shell-text)]">
              Publish Blockers
            </h2>
          </div>
          <p className="mt-2 text-sm text-[color:var(--admin-shell-text-muted)]">
            Editions still blocked by page QA, missing stories, or weak extraction coverage.
          </p>

          <div className="mt-5 space-y-3">
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
                      <p className="truncate text-sm font-semibold text-[color:var(--admin-shell-text)]">
                        {edition.title}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--admin-shell-text-muted)]">
                        {edition.cityName} / {formatWorkflowStatusLabel(edition.productionStatus)}
                      </p>
                    </div>
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">
                      {edition.blockerCount} blockers
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
              <div className={EMPTY_STATE_CLASS}>
                No editions are blocked right now.
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
        </div>
      </section>
    </CmsCollectionPage>
  );
}
