import Link from 'next/link';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import type {
  SuperAdminAlert,
  SuperAdminActionGroup,
  SuperAdminDashboardData,
  SuperAdminGrowthHighlight,
} from '@/lib/admin/superAdminDashboard';
import type { WorkflowArticleCard } from '@/lib/admin/articleWorkflowOverview';
import { formatUiDate } from '@/lib/utils/dateFormat';
import formatNumber from '@/lib/utils/formatNumber';

const SECTION_LINK_CLASS =
  'admin-shell-toolbar-btn inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] sm:text-xs sm:tracking-[0.14em]';

const PANEL_CLASS =
  'admin-shell-surface-strong rounded-[20px] p-3 sm:rounded-[32px] sm:p-6';

const SOFT_CARD_CLASS =
  'admin-shell-surface-muted rounded-[18px] p-3 shadow-[0_18px_48px_-40px_rgba(15,23,42,0.12)] sm:rounded-[24px] sm:p-4 dark:shadow-[0_18px_48px_-40px_rgba(0,0,0,0.4)]';

const METRIC_CARD_CLASS =
  'admin-shell-surface rounded-[16px] p-3 shadow-sm sm:rounded-[22px] sm:p-4';

const EMPTY_STATE_CLASS =
  'rounded-[24px] border border-dashed border-[color:var(--admin-shell-border-strong)] bg-[color:var(--admin-shell-surface-muted)] p-4 text-sm text-[color:var(--admin-shell-text-muted)]';

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ');
}

function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatContentTypeLabel(contentType: string) {
  return contentType === 'epaper' ? 'E-Paper' : formatStatusLabel(contentType);
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
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getWorkflowToneClass(status)}`}>
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

export function DecisionCenterSection({
  readyDecisionItems,
  blockedEditionItems,
  alerts,
}: {
  readyDecisionItems: WorkflowArticleCard[];
  blockedEditionItems: SuperAdminDashboardData['blockedEditionItems'];
  alerts: SuperAdminAlert[];
}) {
  const visibleReadyDecisionItems = readyDecisionItems.slice(0, 4);
  const visibleBlockedEditionItems = blockedEditionItems.slice(0, 4);
  const criticalAlerts = alerts.filter((alert) => alert.severity === 'critical').length;
  const warningAlerts = alerts.filter((alert) => alert.severity === 'warning').length;

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
          <Link href="/admin/review-queue" className={SECTION_LINK_CLASS}>Open Review Queue</Link>
          <Link href="/admin/epapers" className={SECTION_LINK_CLASS}>Open E-Papers</Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          ['Ready Decisions', readyDecisionItems.length],
          ['Edition Blockers', blockedEditionItems.length],
          ['Urgent Signals', alerts.length],
        ].map(([label, value]) => (
          <div key={label} className={METRIC_CARD_CLASS}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{label}</p>
            <p className="mt-2 text-2xl font-black text-zinc-950 dark:text-zinc-50">{formatNumber(Number(value))}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Ready Decisions</h3>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              {formatNumber(readyDecisionItems.length)}
            </span>
          </div>
          {visibleReadyDecisionItems.length ? visibleReadyDecisionItems.map((item) => (
            <Link key={`${item.contentType}-${item.id}`} href={item.editHref} className={cx(SOFT_CARD_CLASS, 'block transition-all hover:-translate-y-0.5 hover:bg-zinc-100 dark:hover:bg-white/10')}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.category} / {formatContentTypeLabel(item.contentType)}</p>
                </div>
                <WorkflowPill status={item.status} />
              </div>
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Updated {formatUiDate(item.updatedAt, item.updatedAt)}</p>
            </Link>
          )) : <div className={EMPTY_STATE_CLASS}>No content is waiting for leadership release decisions right now.</div>}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Blocked Editions</h3>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
              {formatNumber(blockedEditionItems.length)}
            </span>
          </div>
          {visibleBlockedEditionItems.length ? visibleBlockedEditionItems.map((edition) => (
            <Link key={edition.epaperId} href={edition.editHref} className={cx(SOFT_CARD_CLASS, 'block transition-all hover:-translate-y-0.5 hover:bg-zinc-100 dark:hover:bg-white/10')}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{edition.title}</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {edition.cityName} / {edition.blockerCount} blocker{edition.blockerCount === 1 ? '' : 's'}
                  </p>
                </div>
                <WorkflowPill status={edition.productionStatus} />
              </div>
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{edition.blockers[0] || 'Edition needs QA or hotspot cleanup before release.'}</p>
            </Link>
          )) : <div className={EMPTY_STATE_CLASS}>No blocked editions are waiting on leadership review right now.</div>}
        </div>
      </div>

      <div className="mt-5 rounded-[20px] border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface)] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Urgent Signals</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Full alert detail is grouped in Operational Watchlist.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">{formatNumber(criticalAlerts)} critical</span>
            <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{formatNumber(warningAlerts)} warning</span>
            <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:bg-white/10 dark:text-zinc-300">{formatNumber(alerts.length)} total</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function OperationalWatchlistSection({
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
  const severityCards: Array<{ key: SuperAdminAlert['severity']; value: number }> = [
    { key: 'critical', value: groupedAlerts.critical.length },
    { key: 'warning', value: groupedAlerts.warning.length },
    { key: 'info', value: groupedAlerts.info.length },
  ];

  return (
    <section className={PANEL_CLASS}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-orange-600" />
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Operational Watchlist</h2>
      </div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Leadership-facing risks grouped by urgency, with direct action paths for the desk.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Blocked Editions', metrics.blockedEditions],
          ['Quality Alerts', metrics.qualityAlerts],
          ['Inbox Escalations', metrics.inboxEscalations],
          ['Queue Backlog', metrics.queueBacklog],
          ['Reporting Alerts', metrics.reportingAlerts],
        ].map(([label, value]) => (
          <div key={label} className={METRIC_CARD_CLASS}>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
            <p className="mt-2 text-2xl font-black text-zinc-900 dark:text-zinc-100">{formatNumber(Number(value))}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {severityCards.map((card) => (
          <div key={card.key} className={`rounded-[22px] border p-4 ${getSeverityToneClass(card.key)}`}>
            <p className="text-xs font-semibold uppercase tracking-wide">{formatSeverityLabel(card.key)} Alerts</p>
            <p className="mt-2 text-2xl font-black">{formatNumber(card.value)}</p>
          </div>
        ))}
      </div>

      {actionGroups.length ? (
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          {actionGroups.map((group) => (
            <Link key={group.id} href={group.href} className={cx(SOFT_CARD_CLASS, 'transition-all hover:-translate-y-0.5 hover:bg-zinc-100 dark:hover:bg-white/10')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{group.title}</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{group.description}</p>
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
        {severityCards.map((card) => card.value > 0 ? (
          <div key={`group-${card.key}`}>
            <div className="mb-3 flex items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getSeverityToneClass(card.key)}`}>{formatSeverityLabel(card.key)}</span>
            </div>
            <div className="space-y-3">
              {groupedAlerts[card.key].slice(0, 3).map((alert) => (
                <Link key={alert.id} href={alert.href} className={cx(SOFT_CARD_CLASS, 'block transition-all hover:-translate-y-0.5 hover:bg-zinc-100 dark:hover:bg-white/10')}>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{alert.message}</p>
                </Link>
              ))}
            </div>
          </div>
        ) : null)}
        {!alerts.length ? <div className={EMPTY_STATE_CLASS}>No leadership alerts need action right now.</div> : null}
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

export function GrowthHighlightsSection({ items }: { items: SuperAdminGrowthHighlight[] }) {
  return (
    <section className={PANEL_CLASS}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Growth Highlights</h2>
          </div>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">The strongest section, channel, and audience-path movement from the last 30 days.</p>
        </div>
        <Link href="/admin/analytics?tab=growth&focus=all&content=all&range=30d&compare=previous" className={SECTION_LINK_CLASS}>Open Growth Watch</Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {items.length ? items.map((item) => (
          <Link key={item.id} href={item.href} className={`rounded-[24px] border p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:opacity-95 ${getGrowthToneClass(item.tone)}`}>
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="mt-2 text-sm leading-6 opacity-90">{item.detail}</p>
          </Link>
        )) : <div className={cx(EMPTY_STATE_CLASS, 'xl:col-span-2')}>Growth highlights will appear once audience and compare-period data has enough history.</div>}
      </div>
    </section>
  );
}

export function QualityWatchlistSection({
  items,
}: {
  items: SuperAdminDashboardData['qualityWatchlist'];
}) {
  const visibleItems = items.slice(0, 4);

  return (
    <section className={PANEL_CLASS}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Quality Watchlist</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Pages that still need hotspot, OCR, or QA cleanup before the edition feels release-ready.</p>
        </div>
        <Link href="/admin/review-queue" className={SECTION_LINK_CLASS}>Open Overview</Link>
      </div>

      <div className="mt-6 space-y-3">
        {visibleItems.length > 0 ? visibleItems.map((page) => (
          <Link key={`${page.epaperId}-${page.pageNumber}`} href={page.editHref} className={cx(SOFT_CARD_CLASS, 'block transition-all hover:-translate-y-0.5 hover:bg-zinc-100 dark:hover:bg-white/10')}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{page.epaperTitle} / Page {page.pageNumber}</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{page.cityName} / {page.issueSummary}</p>
              </div>
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">{page.qualityLabel}</span>
            </div>
          </Link>
        )) : <div className={EMPTY_STATE_CLASS}>No active page-quality alerts right now.</div>}
        {items.length > visibleItems.length ? (
          <p className="px-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">+{formatNumber(items.length - visibleItems.length)} more quality issues are available in the review queue.</p>
        ) : null}
      </div>
    </section>
  );
}
