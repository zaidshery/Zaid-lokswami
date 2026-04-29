import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ClipboardList, Newspaper, UserCog } from 'lucide-react';
import { getAdminSession } from '@/lib/auth/admin';
import { canViewPage } from '@/lib/auth/permissions';
import { formatUserRoleLabel } from '@/lib/auth/roles';
import { getNewsroomControlCenterData } from '@/lib/admin/newsroomControlCenter';
import { formatUiDate } from '@/lib/utils/dateFormat';
import formatNumber from '@/lib/utils/formatNumber';
import DeskWorkflowActions from '@/app/(admin)/admin/DeskWorkflowActions';

function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function hasReporterSummary(item: Awaited<ReturnType<typeof getNewsroomControlCenterData>>['assignments'][number]) {
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

const PANEL_CLASS =
  'rounded-[20px] border border-zinc-200/80 bg-white/92 p-3 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.38)] sm:rounded-[32px] sm:p-6 dark:border-white/10 dark:bg-zinc-950/60';

const SOFT_CARD_CLASS =
  'rounded-[18px] border border-zinc-200/80 bg-zinc-50/78 p-3 shadow-[0_18px_48px_-40px_rgba(15,23,42,0.3)] sm:rounded-[24px] sm:p-4 dark:border-white/10 dark:bg-white/[0.03]';

const META_CHIP_CLASS =
  'inline-flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-300';

export default async function AssignmentsPage() {
  const admin = await getAdminSession();
  if (!admin) {
    redirect('/signin?redirect=/admin/assignments');
  }

  if (!canViewPage(admin.role, 'assignments')) {
    redirect('/admin');
  }

  const control = await getNewsroomControlCenterData();

  return (
    <div className="mx-auto max-w-[1640px] space-y-4 sm:space-y-8">
      <section className="relative overflow-hidden rounded-[36px] border border-zinc-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.97),rgba(245,247,251,0.95)_48%,rgba(239,246,244,0.97)_100%)] p-8 shadow-[0_30px_90px_-52px_rgba(15,23,42,0.42)] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(18,18,22,0.98),rgba(15,19,33,0.98)_48%,rgba(16,29,24,0.96)_100%)] lg:p-10">
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
            {formatUserRoleLabel(admin.role)}
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-5xl">
            Assignment Desk
          </h1>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-zinc-600 dark:text-zinc-300 sm:text-[15px]">
            Manage current handoffs between the reporting desk, copy desk, and edition production.
            This is the admin-control view for what is assigned, what is still unowned, and what
            needs follow-through right now.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className={META_CHIP_CLASS}>Assigned {formatNumber(control.stats.assignedItems)}</span>
            <span className={META_CHIP_CLASS}>Unassigned {formatNumber(control.stats.unassignedItems)}</span>
            <span className={META_CHIP_CLASS}>Blocked Editions {formatNumber(control.stats.blockedEditions)}</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr,0.85fr]">
        <section className={PANEL_CLASS}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Live Assignments</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Current content and edition work already owned by someone on the desk.
              </p>
            </div>
            <Link href="/admin/content-queue" className={cx(META_CHIP_CLASS, 'w-fit')}>
              Open Content Queue
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            {control.assignments.length ? (
              control.assignments.map((item) => (
                <div
                  key={`${item.contentType}-${item.id}`}
                  className={`${SOFT_CARD_CLASS} transition-colors hover:border-zinc-300/80 dark:hover:border-white/20`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={item.editHref}
                        className="block truncate text-sm font-semibold text-zinc-900 transition-colors hover:text-red-600 dark:text-zinc-100 dark:hover:text-red-300"
                      >
                        {item.title}
                      </Link>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {item.category} / {item.author} / {item.assignedToName}
                      </p>
                    </div>
                    <span className={META_CHIP_CLASS}>{formatStatusLabel(item.status)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>{item.queueLabel}</span>
                    <span>Updated {formatUiDate(item.updatedAt, item.updatedAt)}</span>
                  </div>
                  {hasReporterSummary(item) || item.copyEditorSummary ? (
                    <div className="mt-4 space-y-3">
                      {hasReporterSummary(item) ? (
                        <div className="flex flex-wrap gap-2">
                          {item.reporterSummary?.locationTag ? (
                            <span className={META_CHIP_CLASS}>Location: {item.reporterSummary.locationTag}</span>
                          ) : null}
                          {item.reporterSummary?.sourceInfo ? (
                            <span className={META_CHIP_CLASS}>Source ready</span>
                          ) : null}
                          {item.reporterSummary?.sourceConfidential ? (
                            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
                              Confidential
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      {item.copyEditorSummary ? (
                        <div className="flex flex-wrap gap-2">
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
              <div className={SOFT_CARD_CLASS}>No active assignments are live right now.</div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className={PANEL_CLASS}>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-600 dark:text-blue-300">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Desk Signals</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Quick assignment pressure signals for the newsroom desk.
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-6">
              <div className={SOFT_CARD_CLASS}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Ready For Admin</p>
                <p className="mt-2 text-3xl font-black text-zinc-950 dark:text-zinc-50">{formatNumber(control.stats.readyForAdmin)}</p>
              </div>
              <div className={SOFT_CARD_CLASS}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Active Users</p>
                <p className="mt-2 text-3xl font-black text-zinc-950 dark:text-zinc-50">{formatNumber(control.stats.activeUsers)}</p>
              </div>
            </div>
          </div>

          <div className={PANEL_CLASS}>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-600 dark:text-amber-300">
                <UserCog className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Needs Assignment</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Items still waiting for the desk to claim or route them.
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {control.contentQueue
                .filter((item) => !item.assignedToName)
                .slice(0, 6)
                .map((item) => (
                  <Link key={`${item.contentType}-${item.id}`} href={item.editHref} className={cx(SOFT_CARD_CLASS, 'block')}>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</p>
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {item.category} / {formatStatusLabel(item.status)}
                    </p>
                    {item.reporterSummary?.locationTag ? (
                      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        Location: {item.reporterSummary.locationTag}
                      </p>
                    ) : null}
                  </Link>
                ))}
              {!control.contentQueue.some((item) => !item.assignedToName) ? (
                <div className={SOFT_CARD_CLASS}>Everything in the active queue already has an owner.</div>
              ) : null}
            </div>
          </div>

          <div className={PANEL_CLASS}>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-orange-500/10 p-3 text-orange-600 dark:text-orange-300">
                <Newspaper className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Edition Risk</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Assignment impact from the current e-paper blockers.
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              {control.stats.blockedEditions
                ? `${formatNumber(control.stats.blockedEditions)} edition blocker(s) are still active, so assignment follow-through matters before release.`
                : 'No edition blockers are active right now.'}
            </p>
          </div>
        </section>
      </section>
    </div>
  );
}
