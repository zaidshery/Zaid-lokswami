import type { AdminRole } from '@/lib/auth/roles';
import type { AnalyticsCenterData, AnalyticsDateRange } from '@/lib/admin/analyticsCenter';

export type AnalyticsLiveTimelinePoint = {
  label: string;
  reviewVolume: number;
  readyDecisions: number;
  blockedEditions: number;
  qualityAlerts: number;
  signIns: number;
  failures: number;
};

export type AnalyticsLiveBarItem = {
  label: string;
  value: number;
  detail?: string;
};

export type AnalyticsLiveChartsSnapshot = {
  generatedAt: string;
  windowLabel: string;
  dataSource: AnalyticsCenterData['dashboard']['source'];
  timeline: AnalyticsLiveTimelinePoint[];
  contentInventory: AnalyticsLiveBarItem[];
  queueByType: AnalyticsLiveBarItem[];
  queueStages: AnalyticsLiveBarItem[];
  leadershipLoad: AnalyticsLiveBarItem[];
  audienceSections: AnalyticsLiveBarItem[];
  audienceChannels: AnalyticsLiveBarItem[];
  audienceSources: AnalyticsLiveBarItem[];
  audiencePageTypes: AnalyticsLiveBarItem[];
  conversionSections: AnalyticsLiveBarItem[];
  teamRoles: AnalyticsLiveBarItem[];
  teamStatus: AnalyticsLiveBarItem[];
  serviceStates: AnalyticsLiveBarItem[];
  systemMetrics: AnalyticsLiveBarItem[];
  epaperQuality: AnalyticsLiveBarItem[];
};

type TimelineBucket = {
  startMs: number;
  endMs: number;
  label: string;
};

function getBucketCount(range: AnalyticsDateRange) {
  switch (range) {
    case 'today':
      return 8;
    case '7d':
      return 7;
    case '90d':
      return 12;
    case '30d':
    default:
      return 10;
  }
}

function formatBucketLabel(startMs: number, range: AnalyticsDateRange) {
  const date = new Date(startMs);
  if (range === 'today') {
    return new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
    }).format(date);
  }

  if (range === '7d') {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
    }).format(date);
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function buildTimelineBuckets(
  startIso: string,
  endIso: string,
  range: AnalyticsDateRange
): TimelineBucket[] {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return [];
  }

  const bucketCount = getBucketCount(range);
  const span = (endMs - startMs) / bucketCount;

  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = Math.round(startMs + span * index);
    const bucketEnd =
      index === bucketCount - 1 ? endMs : Math.round(startMs + span * (index + 1));

    return {
      startMs: bucketStart,
      endMs: bucketEnd,
      label: formatBucketLabel(bucketStart, range),
    };
  });
}

function buildBucketCounts(
  values: Array<string | null | undefined>,
  buckets: TimelineBucket[]
) {
  const counts = Array.from({ length: buckets.length }, () => 0);

  values.forEach((value) => {
    if (!value) return;
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return;

    const bucketIndex = buckets.findIndex(
      (bucket, index) =>
        timestamp >= bucket.startMs &&
        (index === buckets.length - 1
          ? timestamp <= bucket.endMs
          : timestamp < bucket.endMs)
    );

    if (bucketIndex >= 0) {
      counts[bucketIndex] += 1;
    }
  });

  return counts;
}

function formatRoleLabel(role: string) {
  switch (role as AdminRole) {
    case 'super_admin':
      return 'Super Admin';
    case 'copy_editor':
      return 'Copy Editor';
    case 'reporter':
      return 'Reporter';
    case 'admin':
    default:
      return 'Admin';
  }
}

function buildStageCount(items: AnalyticsCenterData['currentPeriod']['reviewItems'], statuses: string[]) {
  return items.filter((item) => statuses.includes(item.status)).length;
}

function sortBars(rows: AnalyticsLiveBarItem[], limit = rows.length) {
  return [...rows].sort((left, right) => right.value - left.value).slice(0, limit);
}

export function buildAnalyticsLiveChartsSnapshot(
  analytics: AnalyticsCenterData
): AnalyticsLiveChartsSnapshot {
  const buckets = buildTimelineBuckets(
    analytics.timeWindow.start,
    analytics.timeWindow.end,
    analytics.timeWindow.range
  );

  const reviewCounts = buildBucketCounts(
    analytics.currentPeriod.reviewItems.map((item) => item.updatedAt),
    buckets
  );
  const readyCounts = buildBucketCounts(
    analytics.currentPeriod.readyDecisionItems.map((item) => item.updatedAt),
    buckets
  );
  const blockedCounts = buildBucketCounts(
    analytics.currentPeriod.blockedEditions.map((edition) => edition.updatedAt),
    buckets
  );
  const qualityCounts = buildBucketCounts(
    analytics.currentPeriod.lowQualityPages.map((page) => page.updatedAt),
    buckets
  );
  const signInCounts = buildBucketCounts(
    analytics.currentPeriod.recentSignInMembers.map((member) => member.lastLoginAt),
    buckets
  );
  const failureCounts = buildBucketCounts(
    analytics.systemHealth.recentFailures.map((failure) => failure.createdAt),
    buckets
  );

  const timeline = buckets.map((bucket, index) => ({
    label: bucket.label,
    reviewVolume: reviewCounts[index] || 0,
    readyDecisions: readyCounts[index] || 0,
    blockedEditions: blockedCounts[index] || 0,
    qualityAlerts: qualityCounts[index] || 0,
    signIns: signInCounts[index] || 0,
    failures: failureCounts[index] || 0,
  }));

  const contentInventory = [
    {
      label: 'Articles',
      value: analytics.contentInventory.articles,
      detail: 'Published and managed article inventory',
    },
    {
      label: 'Stories',
      value: analytics.contentInventory.stories,
      detail: 'Short-form story inventory',
    },
    {
      label: 'Videos',
      value: analytics.contentInventory.videos,
      detail: 'Current video inventory',
    },
    {
      label: 'E-Papers',
      value: analytics.contentInventory.epapers,
      detail: 'Stored edition inventory',
    },
  ];

  const queueByType = [
    {
      label: 'Articles',
      value: analytics.currentPeriod.queueMetrics.queueByType.article,
      detail: 'Items with workflow activity',
    },
    {
      label: 'Stories',
      value: analytics.currentPeriod.queueMetrics.queueByType.story,
      detail: 'Items with workflow activity',
    },
    {
      label: 'Videos',
      value: analytics.currentPeriod.queueMetrics.queueByType.video,
      detail: 'Items with workflow activity',
    },
    {
      label: 'E-Papers',
      value: analytics.currentPeriod.queueMetrics.queueByType.epaper,
      detail: 'Items with workflow activity',
    },
  ];

  const queueStages = [
    {
      label: 'Submitted',
      value: buildStageCount(analytics.currentPeriod.reviewItems, ['submitted']),
      detail: 'Waiting for first pickup',
    },
    {
      label: 'Desk Work',
      value: buildStageCount(analytics.currentPeriod.reviewItems, [
        'assigned',
        'in_review',
        'copy_edit',
        'changes_requested',
      ]),
      detail: 'Active editorial work',
    },
    {
      label: 'Edition QA',
      value: buildStageCount(analytics.currentPeriod.reviewItems, [
        'pages_ready',
        'ocr_review',
        'hotspot_mapping',
        'qa_review',
      ]),
      detail: 'Edition production and QA',
    },
    {
      label: 'Ready',
      value: analytics.currentPeriod.queueMetrics.readyDecisions,
      detail: 'Cleared for release',
    },
  ];

  const leadershipLoad = [
    {
      label: 'Ready Decisions',
      value: analytics.currentPeriod.queueMetrics.readyDecisions,
      detail: 'Cleared and waiting',
    },
    {
      label: 'Blocked Editions',
      value: analytics.currentPeriod.blockedEditions.length,
      detail: 'Still blocked',
    },
    {
      label: 'Inbox Escalations',
      value: analytics.dashboard.inbox.new,
      detail: 'Still waiting for visibility',
    },
    {
      label: 'Team Coverage',
      value: analytics.teamHealth.totals.active,
      detail: 'Active desk members',
    },
  ];

  const audienceSections = sortBars(
    analytics.audienceAnalytics.current.sectionBreakdown.map((row) => ({
      label: row.section,
      value: row.pageViews,
      detail: `${row.sessions} session(s)`,
    })),
    5
  );

  const audienceChannels = sortBars(
    analytics.audienceAnalytics.current.channelBreakdown.map((row) => ({
      label: row.channel,
      value: row.events,
      detail: `${row.sessions} session(s)`,
    })),
    5
  );

  const audienceSources = sortBars(
    analytics.audienceAnalytics.current.sourceBreakdown.map((row) => ({
      label: row.source,
      value: row.events,
      detail: `${row.sessions} session(s)`,
    })),
    5
  );

  const audiencePageTypes = sortBars(
    analytics.audienceAnalytics.current.pageTypeBreakdown.map((row) => ({
      label: row.pageType,
      value: row.events,
      detail: row.section,
    })),
    5
  );

  const conversionSections = sortBars(
    analytics.audienceAnalytics.current.sectionConversionBreakdown.map((row) => ({
      label: row.label,
      value: Math.round(row.overallConversionRate * 1000) / 10,
      detail: `${row.conversionSessions}/${row.sessions} converting sessions`,
    })),
    5
  );

  const teamRoles = sortBars(
    Object.entries(analytics.teamHealth.roleCounts).map(([role, value]) => ({
      label: formatRoleLabel(role),
      value,
      detail: 'Assigned accounts',
    }))
  );

  const teamStatus = [
    {
      label: 'Active',
      value: analytics.teamHealth.totals.active,
      detail: 'Available right now',
    },
    {
      label: 'Inactive',
      value: analytics.teamHealth.totals.inactive,
      detail: 'Disabled or unavailable',
    },
    {
      label: 'Never Signed In',
      value: analytics.teamHealth.totals.neverLoggedIn,
      detail: 'Needs onboarding',
    },
    {
      label: 'Recent 7d',
      value: analytics.teamHealth.totals.recentLogins7d,
      detail: 'Seen in last 7 days',
    },
  ];

  const serviceStateMap = analytics.systemHealth.services.reduce<Record<string, number>>(
    (summary, service) => {
      summary[service.status] = (summary[service.status] || 0) + 1;
      return summary;
    },
    { healthy: 0, watch: 0, critical: 0, inactive: 0 }
  );

  const serviceStates = [
    { label: 'Healthy', value: serviceStateMap.healthy || 0, detail: 'Services running normally' },
    { label: 'Watch', value: serviceStateMap.watch || 0, detail: 'Needs follow-up' },
    { label: 'Critical', value: serviceStateMap.critical || 0, detail: 'Requires action' },
    { label: 'Inactive', value: serviceStateMap.inactive || 0, detail: 'Disabled or off' },
  ];

  const systemMetrics = [
    {
      label: 'Service Risks',
      value: analytics.systemHealth.metrics.serviceRisks,
      detail: 'Watch or critical services',
    },
    {
      label: 'Recent Failures',
      value: analytics.systemHealth.metrics.recentFailures,
      detail: 'Failures in current window',
    },
    {
      label: 'Failed Assets',
      value: analytics.systemHealth.metrics.failedAssets,
      detail: 'Shared TTS failures',
    },
    {
      label: 'Enabled Surfaces',
      value: analytics.systemHealth.metrics.enabledSurfaces,
      detail: 'Runtime surfaces enabled',
    },
  ];

  const epaperQuality = [
    {
      label: 'Blocked Editions',
      value: analytics.currentPeriod.blockedEditions.length,
      detail: 'Still blocked',
    },
    {
      label: 'Quality Alerts',
      value: analytics.currentPeriod.lowQualityPages.length,
      detail: 'Pages flagged for attention',
    },
    {
      label: 'Ready Editions',
      value: analytics.currentPeriod.queueMetrics.readyEditionCount,
      detail: 'Ready to publish',
    },
    {
      label: 'Edition Activity',
      value: analytics.currentPeriod.queueMetrics.queueByType.epaper,
      detail: 'Editions touched in workflow',
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    windowLabel: analytics.timeWindow.label,
    dataSource: analytics.dashboard.source,
    timeline,
    contentInventory,
    queueByType,
    queueStages,
    leadershipLoad,
    audienceSections,
    audienceChannels,
    audienceSources,
    audiencePageTypes,
    conversionSections,
    teamRoles,
    teamStatus,
    serviceStates,
    systemMetrics,
    epaperQuality,
  };
}
