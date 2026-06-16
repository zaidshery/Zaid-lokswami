import {
  getReviewQueueOverview,
  type ReviewQueueOverview,
  type WorkflowArticleCard,
} from '@/lib/admin/articleWorkflowOverview';
import {
  buildLeadershipReportEscalations,
  buildLeadershipReportHealthAlerts,
  getLeadershipReportRuntimeSnapshot,
} from '@/lib/admin/leadershipReportHealth';
import { getAudienceAnalyticsSummary } from '@/lib/admin/audienceAnalytics';
import { buildBusinessGrowthInsights } from '@/lib/admin/businessGrowthInsights';
import { getAdminDashboardData, type AdminDashboardData } from '@/lib/admin/dashboard';
import {
  getEpaperInsights,
  type EpaperInsights,
  type EpaperLowQualityPage,
  type EpaperBlockedEdition,
} from '@/lib/admin/epaperInsights';
import { getTeamHealthSummary, type TeamHealthSummary } from '@/lib/admin/teamHealth';
import { listLeadershipReportRunHistory } from '@/lib/storage/leadershipReportRunHistoryFile';
import { listLeadershipReportSchedules } from '@/lib/storage/leadershipReportSchedulesFile';

export type SuperAdminAlert = {
  id: string;
  message: string;
  href: string;
  severity: 'critical' | 'warning' | 'info';
};

export type SuperAdminActionGroup = {
  id: string;
  title: string;
  description: string;
  href: string;
  count: number;
};

export type SuperAdminDashboardMetrics = {
  contentInventory: number;
  workflowPressure: number;
  readyDecisions: number;
  blockedEditions: number;
  qualityAlerts: number;
  inboxEscalations: number;
  queueBacklog: number;
  teamCoverage: number;
  activeEditionCount: number;
  readyEditionCount: number;
  reportingAlerts: number;
};

export type SuperAdminGrowthHighlight = {
  id: string;
  title: string;
  detail: string;
  href: string;
  tone: 'good' | 'watch' | 'critical';
};

export type SuperAdminDashboardData = {
  dashboard: AdminDashboardData;
  reviewQueue: ReviewQueueOverview;
  epaperInsights: EpaperInsights;
  teamHealth: TeamHealthSummary;
  metrics: SuperAdminDashboardMetrics;
  readyDecisionItems: WorkflowArticleCard[];
  newsroomOverviewItems: WorkflowArticleCard[];
  qualityWatchlist: EpaperLowQualityPage[];
  blockedEditionItems: EpaperBlockedEdition[];
  leadershipAlerts: SuperAdminAlert[];
  actionGroups: SuperAdminActionGroup[];
  growthHighlights: SuperAdminGrowthHighlight[];
};

function getGrowthWindow() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  const previousEnd = new Date(start);
  const previousStart = new Date(start);
  previousStart.setDate(previousStart.getDate() - 30);

  return { start, end, previousStart, previousEnd };
}

function buildGrowthHighlights() {
  const window = getGrowthWindow();
  return getAudienceAnalyticsSummary(window).then((audienceAnalytics) => {
    const insights = buildBusinessGrowthInsights({
      sectionBreakdown: audienceAnalytics.current.sectionBreakdown,
      sectionTrends: audienceAnalytics.current.sectionTrends,
      sectionConversionBreakdown: audienceAnalytics.current.sectionConversionBreakdown,
      sectionConversionTrends: audienceAnalytics.current.sectionConversionTrends,
      channelBreakdown: audienceAnalytics.current.channelBreakdown,
      channelTrends: audienceAnalytics.current.channelTrends,
      channelConversionBreakdown: audienceAnalytics.current.channelConversionBreakdown,
      channelConversionTrends: audienceAnalytics.current.channelConversionTrends,
      pathConversionLeaders: audienceAnalytics.current.pathConversionLeaders,
      pathConversionLaggards: audienceAnalytics.current.pathConversionLaggards,
    });

    const highlights: SuperAdminGrowthHighlight[] = [];
    const sectionLeader = insights.sectionLeaders[0];
    const channelLeader = insights.channelLeaders[0];

    if (sectionLeader) {
      highlights.push({
        id: 'section-leader',
        title: `Section leader: ${sectionLeader.label}`,
        detail: `${sectionLeader.momentumDelta >= 0 ? '+' : ''}${sectionLeader.momentumDelta} momentum with ${sectionLeader.conversionRate.toFixed(1)}% conversion over ${sectionLeader.sessions} sessions.`,
        href: '/admin/analytics?tab=growth&focus=all&content=all&range=30d&compare=previous',
        tone: 'good',
      });
    }

    if (channelLeader) {
      highlights.push({
        id: 'channel-leader',
        title: `Channel win: ${channelLeader.label}`,
        detail: `${channelLeader.momentumDelta >= 0 ? '+' : ''}${channelLeader.momentumDelta} momentum with ${channelLeader.conversionRate.toFixed(1)}% conversion across ${channelLeader.sessions} sessions.`,
        href: '/admin/analytics?tab=growth&focus=all&content=all&range=30d&compare=previous',
        tone: 'good',
      });
    }

    if (insights.watchlist.length) {
      highlights.push(
        ...insights.watchlist.slice(0, 2).map((item) => ({
          id: item.id,
          title: item.title,
          detail: item.detail,
          href: '/admin/analytics?tab=growth&focus=all&content=all&range=30d&compare=previous',
          tone: item.tone,
        }))
      );
    }

    return highlights.slice(0, 4);
  });
}

function buildActionGroups(
  metrics: SuperAdminDashboardMetrics,
  teamHealth: TeamHealthSummary
): SuperAdminActionGroup[] {
  const groups: SuperAdminActionGroup[] = [];

  if (metrics.blockedEditions > 0) {
    groups.push({
      id: 'blocked-editions',
      title: 'Resolve Edition Blockers',
      description: 'Clear publish blockers on editions before release.',
      href: '/admin/epapers',
      count: metrics.blockedEditions,
    });
  }

  if (metrics.queueBacklog > 0) {
    groups.push({
      id: 'review-backlog',
      title: 'Reduce Review Backlog',
      description: 'Move active queue items toward approval, scheduling, or rejection.',
      href: '/admin/review-queue',
      count: metrics.queueBacklog,
    });
  }

  if (metrics.inboxEscalations > 0) {
    groups.push({
      id: 'inbox-escalations',
      title: 'Handle Inbox Escalations',
      description: 'Clear reader or operations messages still waiting for a response.',
      href: '/admin/contact-messages',
      count: metrics.inboxEscalations,
    });
  }

  if (metrics.qualityAlerts > 0) {
    groups.push({
      id: 'quality-alerts',
      title: 'Review Quality Alerts',
      description: 'Send desk attention to low-quality e-paper pages and QA warnings.',
      href: '/admin/review-queue',
      count: metrics.qualityAlerts,
    });
  }

  if (metrics.reportingAlerts > 0) {
    groups.push({
      id: 'report-delivery',
      title: 'Review Report Delivery',
      description: 'Leadership briefings have failed runs, escalations, or missing delivery readiness.',
      href: '/admin/analytics',
      count: metrics.reportingAlerts,
    });
  }

  if (teamHealth.alerts.length > 0) {
    groups.push({
      id: 'team-coverage',
      title: 'Review Team Coverage',
      description: 'Check inactive, missing, or never-signed-in admin accounts.',
      href: '/admin/team',
      count: teamHealth.alerts.length,
    });
  }

  return groups.slice(0, 4);
}

function buildLeadershipAlerts(
  metrics: SuperAdminDashboardMetrics,
  teamHealth: TeamHealthSummary,
  reportAlerts: SuperAdminAlert[]
): SuperAdminAlert[] {
  const alerts: SuperAdminAlert[] = [];

  if (metrics.blockedEditions > 0) {
    alerts.push({
      id: 'blocked-editions',
      message: `${metrics.blockedEditions} blocked edition${
        metrics.blockedEditions === 1 ? '' : 's'
      } still need leadership attention.`,
      href: '/admin/epapers',
      severity: 'critical',
    });
  }

  if (metrics.qualityAlerts > 0) {
    alerts.push({
      id: 'quality-alerts',
      message: `${metrics.qualityAlerts} low-quality e-paper page${
        metrics.qualityAlerts === 1 ? '' : 's'
      } still need cleanup.`,
      href: '/admin/review-queue',
      severity: metrics.qualityAlerts >= 5 ? 'critical' : 'warning',
    });
  }

  if (metrics.inboxEscalations > 0) {
    alerts.push({
      id: 'inbox-escalations',
      message: `${metrics.inboxEscalations} inbox escalation${
        metrics.inboxEscalations === 1 ? '' : 's'
      } are still unresolved.`,
      href: '/admin/contact-messages',
      severity: metrics.inboxEscalations >= 5 ? 'critical' : 'warning',
    });
  }

  if (metrics.queueBacklog > 0) {
    alerts.push({
      id: 'queue-backlog',
      message: `${metrics.queueBacklog} workflow item${
        metrics.queueBacklog === 1 ? '' : 's'
      } still sit in active review.`,
      href: '/admin/review-queue',
      severity: metrics.queueBacklog >= 12 ? 'critical' : 'warning',
    });
  }

  teamHealth.alerts.forEach((alert, index) => {
    alerts.push({
      id: `team-alert-${index + 1}`,
      message: alert,
      href: '/admin/team',
      severity: alert.toLowerCase().includes('no super admin') ? 'critical' : 'info',
    });
  });

  alerts.push(...reportAlerts);

  const severityRank = { critical: 0, warning: 1, info: 2 } as const;
  return alerts
    .sort((left, right) => severityRank[left.severity] - severityRank[right.severity])
    .slice(0, 6);
}

function buildReportingSuperAdminAlerts() {
  return Promise.all([listLeadershipReportSchedules(), listLeadershipReportRunHistory(12)]).then(
    async ([schedules, history]) => {
      const runtime = await getLeadershipReportRuntimeSnapshot(schedules);
      const healthAlerts = buildLeadershipReportHealthAlerts({
        schedules,
        history,
        runtime,
      }).filter((alert) => alert.id !== 'healthy' && alert.severity !== 'info');
      const escalations = buildLeadershipReportEscalations({
        schedules,
        history,
        runtime,
      });

      const mappedEscalations: SuperAdminAlert[] = escalations.map((escalation) => ({
        id: `report-escalation-${escalation.scheduleId}`,
        message: `${escalation.label}: ${escalation.reason}`,
        href: escalation.actionHref,
        severity: escalation.severity,
      }));

      const mappedHealthAlerts: SuperAdminAlert[] = healthAlerts.map((alert) => ({
        id: `report-alert-${alert.id}`,
        message: `${alert.title}: ${alert.detail}`,
        href: alert.actionHref || '/admin/analytics',
        severity: alert.severity,
      }));

      const seen = new Set<string>();
      const alerts = [...mappedEscalations, ...mappedHealthAlerts].filter((alert) => {
        if (seen.has(alert.id)) return false;
        seen.add(alert.id);
        return true;
      });

      return {
        alerts,
      };
    }
  );
}

export async function getSuperAdminDashboardData(): Promise<SuperAdminDashboardData> {
  const [dashboard, reviewQueue, epaperInsights, teamHealth, reporting, growthHighlights] =
    await Promise.all([
    getAdminDashboardData(),
    getReviewQueueOverview(),
    getEpaperInsights(),
    getTeamHealthSummary(),
    buildReportingSuperAdminAlerts(),
    buildGrowthHighlights(),
  ]);

  const readyEditionCount = Number(reviewQueue.productionCounts.ready_to_publish || 0);
  const activeEditionCount =
    Number(reviewQueue.productionCounts.pages_ready || 0) +
    Number(reviewQueue.productionCounts.ocr_review || 0) +
    Number(reviewQueue.productionCounts.hotspot_mapping || 0);

  const metrics: SuperAdminDashboardMetrics = {
    contentInventory:
      dashboard.stats.totalArticles + dashboard.stats.totalVideos + dashboard.stats.totalEPapers,
    workflowPressure: dashboard.workflow.needsReview + activeEditionCount,
    readyDecisions: dashboard.workflow.readyToPublish + readyEditionCount,
    blockedEditions: epaperInsights.blockedEditions.length,
    qualityAlerts: epaperInsights.lowQualityPages.length,
    inboxEscalations: dashboard.inbox.new,
    queueBacklog: dashboard.workflow.needsReview + activeEditionCount,
    teamCoverage: teamHealth.totals.active,
    activeEditionCount,
    readyEditionCount,
    reportingAlerts: reporting.alerts.length,
  };

  const readyDecisionItems = reviewQueue.items
    .filter(
      (item) =>
        item.status === 'ready_for_approval' ||
        item.status === 'approved' ||
        item.status === 'scheduled' ||
        item.status === 'ready_to_publish'
    )
    .slice(0, 5);

  return {
    dashboard,
    reviewQueue,
    epaperInsights,
    teamHealth,
    metrics,
    readyDecisionItems,
    newsroomOverviewItems: reviewQueue.items.slice(0, 8),
    qualityWatchlist: epaperInsights.lowQualityPages.slice(0, 5),
    blockedEditionItems: epaperInsights.blockedEditions.slice(0, 5),
    leadershipAlerts: buildLeadershipAlerts(metrics, teamHealth, reporting.alerts),
    actionGroups: buildActionGroups(metrics, teamHealth),
    growthHighlights,
  };
}
