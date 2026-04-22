import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, FileText, MessageSquare, Newspaper, Video } from 'lucide-react';
import { getAdminSession } from '@/lib/auth/admin';
import { getReviewQueueOverview } from '@/lib/admin/articleWorkflowOverview';
import { getAdminDashboardData } from '@/lib/admin/dashboard';
import { getEpaperInsights } from '@/lib/admin/epaperInsights';
import { canViewPage } from '@/lib/auth/permissions';
import { formatUserRoleLabel } from '@/lib/auth/roles';
import { formatUiDate } from '@/lib/utils/dateFormat';
import formatNumber from '@/lib/utils/formatNumber';
import {
  CmsCollectionHero,
  CmsCollectionPage,
  CMS_COLLECTION_EMPTY_STATE_CLASS as EMPTY_STATE_CLASS,
  CMS_COLLECTION_META_CHIP_CLASS as META_CHIP_CLASS,
  CMS_COLLECTION_PANEL_CLASS as PANEL_CLASS,
  CMS_COLLECTION_SOFT_CARD_CLASS as SOFT_CARD_CLASS,
} from '@/components/admin/CmsCollectionLayout';

type QueueCard = {
  title: string;
  description: string;
  href: string;
  count: number;
  icon: typeof FileText;
  tone: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatContentTypeLabel(contentType: string) {
  return contentType === 'epaper' ? 'E-Paper' : formatStatusLabel(contentType);
}

export default async function AdminReviewQueuePage() {
  const admin = await getAdminSession();
  if (!admin) {
    redirect('/signin?redirect=/admin/review-queue');
  }
  if (!canViewPage(admin.role, 'review_queue')) {
    redirect('/admin');
  }

  const dashboard = await getAdminDashboardData();
  const reviewQueue = await getReviewQueueOverview();
  const epaperInsights = await getEpaperInsights();

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

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {queueCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="admin-shell-surface-strong rounded-[28px] p-6 transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className={`inline-flex rounded-2xl p-3 ${card.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-xl font-bold text-[color:var(--admin-shell-text)]">
                    {card.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--admin-shell-text-muted)]">
                    {card.description}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--admin-shell-text-muted)]">
                    Current Volume
                  </p>
                  <p className="mt-2 text-3xl font-black text-[color:var(--admin-shell-text)]">
                    {formatNumber(card.count)}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      <section className={PANEL_CLASS}>
        <div>
          <div>
            <h2 className="text-xl font-bold text-[color:var(--admin-shell-text)]">
              Live Newsroom Queue
            </h2>
            <p className="mt-1 text-sm text-[color:var(--admin-shell-text-muted)]">
              Mixed workflow and production items currently waiting on editorial or production desk action.
            </p>
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
                    {item.category} / {item.author} / {formatContentTypeLabel(item.contentType)}
                  </p>
                </div>
                <span className={META_CHIP_CLASS}>
                  {formatStatusLabel(item.status)}
                </span>
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
              epaperInsights.lowQualityPages.map((page) => (
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
                    <span>Page QA: {formatStatusLabel(page.reviewStatus)}</span>
                    {page.reviewedByName ? <span>Reviewer: {page.reviewedByName}</span> : null}
                  </div>
                </Link>
              ))
            ) : (
              <div className={EMPTY_STATE_CLASS}>
                No low-quality e-paper pages are active right now.
              </div>
            )}
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
              epaperInsights.blockedEditions.map((edition) => (
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
                        {edition.cityName} / {formatStatusLabel(edition.productionStatus)}
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
          </div>
        </div>
      </section>
    </CmsCollectionPage>
  );
}
