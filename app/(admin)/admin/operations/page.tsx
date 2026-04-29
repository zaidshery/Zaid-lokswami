import Link from 'next/link';
import { redirect } from 'next/navigation';
import OperationsCenterTabs from '@/components/admin/OperationsCenterTabs';
import {
  DecisionCenterSection,
  GrowthHighlightsSection,
  OperationalWatchlistSection,
  QualityWatchlistSection,
} from '@/components/admin/NewsroomOperationsSections';
import { getSuperAdminDashboardData } from '@/lib/admin/superAdminDashboard';
import { getAdminSession } from '@/lib/auth/admin';
import { canViewPage } from '@/lib/auth/permissions';
import formatNumber from '@/lib/utils/formatNumber';

const PANEL_CLASS =
  'admin-shell-surface-strong rounded-[20px] p-3 sm:rounded-[32px] sm:p-6';

const SECTION_LINK_CLASS =
  'admin-shell-toolbar-btn inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] sm:text-xs sm:tracking-[0.14em]';

export default async function OperationsCenterPage() {
  const admin = await getAdminSession();
  if (!admin) {
    redirect('/signin?redirect=/admin/operations');
  }

  if (!canViewPage(admin.role, 'operations_center')) {
    redirect('/admin');
  }

  const data = await getSuperAdminDashboardData();
  const metrics = data.metrics;

  const watchlistMetrics = {
    blockedEditions: metrics.blockedEditions || 0,
    qualityAlerts: metrics.qualityAlerts || 0,
    inboxEscalations: metrics.inboxEscalations || data.dashboard.inbox.new,
    queueBacklog:
      metrics.queueBacklog ||
      data.dashboard.workflow.needsReview + metrics.activeEditionCount,
    reportingAlerts: metrics.reportingAlerts || 0,
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 sm:space-y-6">
      <section className={PANEL_CLASS}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600">
              Operations Center
            </p>
            <h1 className="mt-2 text-2xl font-black text-[color:var(--admin-shell-text)] sm:text-3xl">
              Decisions, risks, quality, and growth
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--admin-shell-text-muted)]">
              A focused leadership workspace for the deeper signals that no longer belong on the daily dashboard.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin" className={SECTION_LINK_CLASS}>
              Back To Dashboard
            </Link>
            <Link href="/admin/analytics" className={SECTION_LINK_CLASS}>
              Open Analytics
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Ready Decisions', metrics.readyDecisions],
            ['Blocked Editions', metrics.blockedEditions],
            ['Quality Alerts', metrics.qualityAlerts],
            ['Reporting Alerts', metrics.reportingAlerts],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-[18px] border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface)] p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-shell-text-muted)]">
                {label}
              </p>
              <p className="mt-2 text-2xl font-black text-[color:var(--admin-shell-text)]">
                {formatNumber(Number(value))}
              </p>
            </div>
          ))}
        </div>
      </section>

      <OperationsCenterTabs
        tabs={[
          {
            id: 'decisions',
            label: 'Decisions',
            description: 'Publishing and blocker calls',
            content: (
              <DecisionCenterSection
                readyDecisionItems={data.readyDecisionItems}
                blockedEditionItems={data.blockedEditionItems}
                alerts={data.leadershipAlerts}
              />
            ),
          },
          {
            id: 'risks',
            label: 'Risks',
            description: 'Alerts and action groups',
            content: (
              <OperationalWatchlistSection
                metrics={watchlistMetrics}
                alerts={data.leadershipAlerts}
                actionGroups={data.actionGroups}
              />
            ),
          },
          {
            id: 'quality',
            label: 'Quality',
            description: 'Edition QA cleanup',
            content: <QualityWatchlistSection items={data.qualityWatchlist} />,
          },
          {
            id: 'growth',
            label: 'Growth',
            description: 'Audience movement',
            content: <GrowthHighlightsSection items={data.growthHighlights} />,
          },
        ]}
      />
    </div>
  );
}
