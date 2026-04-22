import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FolderOpen, Layers3 } from 'lucide-react';
import { getAdminSession } from '@/lib/auth/admin';
import { canViewPage } from '@/lib/auth/permissions';
import { formatUserRoleLabel } from '@/lib/auth/roles';
import { getNewsroomControlCenterData } from '@/lib/admin/newsroomControlCenter';
import { formatUiDate } from '@/lib/utils/dateFormat';
import formatNumber from '@/lib/utils/formatNumber';
import DeskWorkflowActions from '@/app/(admin)/admin/DeskWorkflowActions';
import {
  CmsCollectionHero,
  CmsCollectionPage,
  CMS_COLLECTION_META_CHIP_CLASS as META_CHIP_CLASS,
  CMS_COLLECTION_PANEL_CLASS as PANEL_CLASS,
  CMS_COLLECTION_SOFT_CARD_CLASS as SOFT_CARD_CLASS,
} from '@/components/admin/CmsCollectionLayout';

function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function hasReporterSummary(item: Awaited<ReturnType<typeof getNewsroomControlCenterData>>['contentQueue'][number]) {
  return Boolean(
    item.reporterSummary &&
      (
        item.reporterSummary.locationTag ||
        item.reporterSummary.sourceInfo ||
        item.reporterSummary.sourceConfidential ||
        item.reporterSummary.reporterNotes
      )
  );
}

export default async function ContentQueuePage() {
  const admin = await getAdminSession();
  if (!admin) {
    redirect('/signin?redirect=/admin/content-queue');
  }

  if (!canViewPage(admin.role, 'content_queue')) {
    redirect('/admin');
  }

  const control = await getNewsroomControlCenterData();
  const queue = control.contentQueue;

  return (
    <CmsCollectionPage>
      <CmsCollectionHero
        accent="amber"
        eyebrow={formatUserRoleLabel(admin.role)}
        title="Content Queue"
        description="The admin queue for everything actively moving across story approval, copy work, and edition release. Use this desk to see what is waiting, what is assigned, and what should be escalated."
        meta={
          <>
            <span className={META_CHIP_CLASS}>Queue {formatNumber(control.stats.queueItems)}</span>
            <span className={META_CHIP_CLASS}>Assigned {formatNumber(control.stats.assignedItems)}</span>
            <span className={META_CHIP_CLASS}>Inbox New {formatNumber(control.stats.inboxNew)}</span>
          </>
        }
      />

      <section className={PANEL_CLASS}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Live Queue</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Mixed workflow and edition work that currently needs newsroom follow-through.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/assignments" className={META_CHIP_CLASS}>
              Open Assignments
            </Link>
            <Link href="/admin/review-queue" className={META_CHIP_CLASS}>
              Review Queue
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          {queue.length ? (
            queue.map((item) => (
              <div
                key={`${item.contentType}-${item.id}`}
                className={`${SOFT_CARD_CLASS} transition-colors hover:border-zinc-300/80 dark:hover:border-white/20`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={item.editHref}
                      className="truncate text-sm font-semibold text-zinc-900 transition-colors hover:text-red-600 dark:text-zinc-100 dark:hover:text-red-300"
                    >
                      {item.title}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {item.category} / {item.author} / {item.queueLabel}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={META_CHIP_CLASS}>{formatStatusLabel(item.status)}</span>
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                        item.urgency === 'high'
                          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300'
                          : 'border-zinc-200 bg-white text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200'
                      }`}
                    >
                      {item.urgency === 'high' ? 'Priority' : 'Active'}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>Updated {formatUiDate(item.updatedAt, item.updatedAt)}</span>
                  {item.assignedToName ? <span>Assignee: {item.assignedToName}</span> : <span>Unassigned</span>}
                  {item.createdByName ? <span>Created by: {item.createdByName}</span> : null}
                </div>
                {hasReporterSummary(item) || item.copyEditorSummary ? (
                  <div className="mt-4 space-y-3">
                    {hasReporterSummary(item) ? (
                      <div className="flex flex-wrap gap-2">
                        {item.reporterSummary?.locationTag ? (
                          <span className={META_CHIP_CLASS}>Location: {item.reporterSummary.locationTag}</span>
                        ) : null}
                        {item.reporterSummary?.sourceInfo ? (
                          <span className={META_CHIP_CLASS}>Source info ready</span>
                        ) : null}
                        {item.reporterSummary?.sourceConfidential ? (
                          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
                            Confidential source
                          </span>
                        ) : null}
                        {item.reporterSummary?.reporterNotes ? (
                          <span className={META_CHIP_CLASS}>Reporter notes attached</span>
                        ) : null}
                      </div>
                    ) : null}
                    {item.copyEditorSummary ? (
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                            item.copyEditorSummary.proofreadComplete
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300'
                              : 'border-zinc-200 bg-white text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200'
                          }`}
                        >
                          Proofread {item.copyEditorSummary.proofreadComplete ? 'Done' : 'Pending'}
                        </span>
                        <span className={META_CHIP_CLASS}>
                          Fact Check {formatStatusLabel(item.copyEditorSummary.factCheckStatus)}
                        </span>
                        <span className={META_CHIP_CLASS}>
                          Headline {formatStatusLabel(item.copyEditorSummary.headlineStatus)}
                        </span>
                        <span className={META_CHIP_CLASS}>
                          Image {formatStatusLabel(item.copyEditorSummary.imageOptimizationStatus)}
                        </span>
                      </div>
                    ) : null}
                    {item.copyEditorSummary?.returnForChangesReason ? (
                      <div className="rounded-[22px] border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                        Return reason: {item.copyEditorSummary.returnForChangesReason}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <DeskWorkflowActions
                  role={admin.role}
                  contentType={item.contentType}
                  contentId={item.id}
                  status={item.status}
                  editHref={item.editHref}
                  assignedToName={item.assignedToName}
                />
              </div>
            ))
          ) : (
            <div className={SOFT_CARD_CLASS}>No active content is waiting in the queue right now.</div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className={PANEL_CLASS}>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-600 dark:text-blue-300">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Queue Split</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">How the live queue is divided right now.</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3">
            <div className={SOFT_CARD_CLASS}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Assigned</p>
              <p className="mt-2 text-3xl font-black text-zinc-950 dark:text-zinc-50">{formatNumber(control.stats.assignedItems)}</p>
            </div>
            <div className={SOFT_CARD_CLASS}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Unassigned</p>
              <p className="mt-2 text-3xl font-black text-zinc-950 dark:text-zinc-50">{formatNumber(control.stats.unassignedItems)}</p>
            </div>
          </div>
        </div>
        <div className={PANEL_CLASS}>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-violet-500/10 p-3 text-violet-600 dark:text-violet-300">
              <Layers3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Ready For Admin</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Items closest to approval or release action.</p>
            </div>
          </div>
          <p className="mt-6 text-4xl font-black text-zinc-950 dark:text-zinc-50">{formatNumber(control.stats.readyForAdmin)}</p>
        </div>
        <div className={PANEL_CLASS}>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">What To Do First</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            <p className={SOFT_CARD_CLASS}>Claim unassigned submissions first so stories do not stall at intake.</p>
            <p className={SOFT_CARD_CLASS}>Move copy-desk returns into approval or back to the reporter quickly.</p>
            <p className={SOFT_CARD_CLASS}>Watch blocked editions alongside the normal queue before release windows.</p>
          </div>
        </div>
      </section>
    </CmsCollectionPage>
  );
}
