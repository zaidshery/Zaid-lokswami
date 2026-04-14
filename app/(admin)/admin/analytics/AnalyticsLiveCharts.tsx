'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Activity, BarChart3, RefreshCw, ShieldAlert, TrendingUp } from 'lucide-react';
import type { AnalyticsCompareMode, AnalyticsDateRange } from '@/lib/admin/analyticsCenter';
import type {
  AnalyticsLiveBarItem,
  AnalyticsLiveChartsSnapshot,
  AnalyticsLiveTimelinePoint,
} from '@/lib/admin/analyticsLiveCharts';

type AnalyticsTab =
  | 'overview'
  | 'audience'
  | 'newsroom_ops'
  | 'epaper_ops'
  | 'team'
  | 'content'
  | 'growth'
  | 'system_health';

const PANEL_CLASS =
  'admin-shell-surface-strong rounded-[32px] p-6';

const SOFT_CARD_CLASS =
  'admin-shell-surface-muted rounded-[24px] p-4 shadow-[0_18px_48px_-40px_rgba(15,23,42,0.12)] dark:shadow-[0_18px_48px_-40px_rgba(0,0,0,0.35)]';

const BAR_TONES = [
  'bg-red-500/90',
  'bg-blue-500/90',
  'bg-emerald-500/90',
  'bg-amber-500/90',
  'bg-violet-500/90',
];

function formatUpdatedAt(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'just now';

  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatValue(value: number, suffix = '') {
  return `${Number.isInteger(value) ? value.toString() : value.toFixed(1)}${suffix}`;
}

function SectionShell({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: typeof Activity;
  children: ReactNode;
}) {
  return (
    <section className={PANEL_CLASS}>
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-red-500/10 p-3 text-red-500">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{description}</p>
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function TimelineChart({
  points,
  series,
}: {
  points: AnalyticsLiveTimelinePoint[];
  series: Array<{
    key: keyof Omit<AnalyticsLiveTimelinePoint, 'label'>;
    label: string;
    toneClass: string;
  }>;
}) {
  const maxValue = Math.max(
    1,
    ...points.flatMap((point) => series.map((item) => Number(point[item.key] || 0)))
  );

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {series.map((item) => (
          <span
            key={item.key}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--admin-shell-border)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--admin-shell-text-muted)]"
          >
            <span className={`h-2.5 w-2.5 rounded-full ${item.toneClass}`} />
            {item.label}
          </span>
        ))}
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {points.map((point) => (
          <div key={point.label} className="flex min-w-[56px] flex-1 flex-col justify-end gap-2">
            <div className="flex h-44 items-end gap-1 rounded-[20px] border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface-muted)] px-2 py-3">
              {series.map((item) => {
                const rawValue = Number(point[item.key] || 0);
                const height = rawValue > 0 ? Math.max(10, (rawValue / maxValue) * 100) : 0;
                return (
                  <div
                    key={`${point.label}-${item.key}`}
                    title={`${item.label}: ${rawValue}`}
                    className={`w-full rounded-t-[10px] ${item.toneClass}`}
                    style={{ height: `${height}%` }}
                  />
                );
              })}
            </div>
            <div className="space-y-1 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--admin-shell-text-muted)]">
                {point.label}
              </p>
              <p className="text-[11px] text-[color:var(--admin-shell-text-muted)]">
                {series.reduce((sum, item) => sum + Number(point[item.key] || 0), 0)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HorizontalBars({
  items,
  valueSuffix,
}: {
  items: AnalyticsLiveBarItem[];
  valueSuffix?: string;
}) {
  const maxValue = Math.max(1, ...items.map((item) => item.value));

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={item.label} className={SOFT_CARD_CLASS}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.label}</p>
              {item.detail ? (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.detail}</p>
              ) : null}
            </div>
            <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">
              {formatValue(item.value, valueSuffix)}
            </span>
          </div>
          <div className="mt-3 h-2.5 rounded-full bg-zinc-200/70 dark:bg-white/10">
            <div
              className={`h-2.5 rounded-full ${BAR_TONES[index % BAR_TONES.length]}`}
              style={{ width: `${Math.max(6, (item.value / maxValue) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ServiceStatusStack({ items }: { items: AnalyticsLiveBarItem[] }) {
  const total = Math.max(1, items.reduce((sum, item) => sum + item.value, 0));
  const toneMap: Record<string, string> = {
    Healthy: 'bg-emerald-500',
    Watch: 'bg-amber-500',
    Critical: 'bg-red-500',
    Inactive: 'bg-zinc-500',
  };

  return (
    <div className="space-y-4">
      <div className="flex h-4 overflow-hidden rounded-full bg-zinc-200/70 dark:bg-white/10">
        {items.map((item) => (
          <div
            key={item.label}
            title={`${item.label}: ${item.value}`}
            className={toneMap[item.label] || 'bg-blue-500'}
            style={{ width: `${(item.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className={SOFT_CARD_CLASS}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.label}</p>
                {item.detail ? (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.detail}</p>
                ) : null}
              </div>
              <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
                {item.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsLiveCharts({
  initialSnapshot,
  activeTab,
  range,
  compare,
}: {
  initialSnapshot: AnalyticsLiveChartsSnapshot;
  activeTab: AnalyticsTab;
  range: AnalyticsDateRange;
  compare: AnalyticsCompareMode;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [connectionMode, setConnectionMode] = useState<'stream' | 'polling'>('stream');
  const [connectionState, setConnectionState] = useState<
    'connecting' | 'live' | 'reconnecting' | 'polling'
  >('connecting');

  useEffect(() => {
    setSnapshot(initialSnapshot);
  }, [initialSnapshot]);

  useEffect(() => {
    let isMounted = true;
    let pollingTimer: number | null = null;
    let eventSource: EventSource | null = null;
    let fallbackStarted = false;

    const refresh = async () => {
      try {
        setIsRefreshing(true);
        const response = await fetch(
          `/api/admin/analytics/live?range=${range}&compare=${compare}`,
          {
            cache: 'no-store',
          }
        );

        if (!response.ok) {
          throw new Error(`Refresh failed with status ${response.status}`);
        }

        const payload = (await response.json()) as {
          success?: boolean;
          snapshot?: AnalyticsLiveChartsSnapshot;
        };

        if (!payload.success || !payload.snapshot) {
          throw new Error('Analytics refresh returned an invalid payload.');
        }

        if (isMounted) {
          setSnapshot(payload.snapshot);
          setRefreshError(null);
          setConnectionMode('polling');
          setConnectionState('polling');
        }
      } catch (error) {
        if (isMounted) {
          setRefreshError(error instanceof Error ? error.message : 'Refresh failed.');
        }
      } finally {
        if (isMounted) {
          setIsRefreshing(false);
        }
      }
    };

    const startPollingFallback = () => {
      if (fallbackStarted) return;
      fallbackStarted = true;
      setConnectionMode('polling');
      setConnectionState('polling');
      void refresh();
      pollingTimer = window.setInterval(() => {
        void refresh();
      }, 30000);
    };

    if (typeof window !== 'undefined' && 'EventSource' in window) {
      setConnectionMode('stream');
      setConnectionState('connecting');
      setIsRefreshing(true);

      eventSource = new EventSource(
        `/api/admin/analytics/live/stream?range=${range}&compare=${compare}`
      );

      eventSource.onopen = () => {
        if (!isMounted) return;
        setConnectionMode('stream');
        setConnectionState('live');
        setRefreshError(null);
      };

      eventSource.addEventListener('snapshot', (event) => {
        if (!isMounted) return;

        try {
          const payload = JSON.parse((event as MessageEvent<string>).data) as {
            success?: boolean;
            snapshot?: AnalyticsLiveChartsSnapshot;
          };

          if (!payload.success || !payload.snapshot) {
            throw new Error('Live stream returned an invalid payload.');
          }

          setSnapshot(payload.snapshot);
          setRefreshError(null);
          setConnectionMode('stream');
          setConnectionState('live');
        } catch (error) {
          setRefreshError(error instanceof Error ? error.message : 'Live stream parse failed.');
        } finally {
          setIsRefreshing(false);
        }
      });

      eventSource.addEventListener('error', (event) => {
        if (!isMounted) return;

        try {
          const payload = JSON.parse((event as MessageEvent<string>).data) as {
            error?: string;
          };
          if (payload.error) {
            setRefreshError(payload.error);
          }
        } catch {
          setRefreshError('Live stream disconnected. Reconnecting...');
        }

        setConnectionState('reconnecting');
        setIsRefreshing(false);
      });

      eventSource.onerror = () => {
        if (!isMounted) return;
        setConnectionState('reconnecting');
        setIsRefreshing(false);
        setRefreshError('Live stream disconnected. Reconnecting...');

        if (eventSource?.readyState === EventSource.CLOSED) {
          startPollingFallback();
        }
      };
    } else {
      startPollingFallback();
    }

    return () => {
      isMounted = false;
      if (pollingTimer) {
        window.clearInterval(pollingTimer);
      }
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [range, compare]);

  return (
    <section className={PANEL_CLASS}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Live Charts</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Visual analytics built from the current admin data and refreshed automatically every 30 seconds.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-shell-text-muted)]">
          <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--admin-shell-border)] px-3 py-2">
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {connectionMode === 'stream' ? 'Live Stream' : 'Polling 30s'}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--admin-shell-border)] px-3 py-2">
            {connectionState === 'live'
              ? 'Connected'
              : connectionState === 'reconnecting'
                ? 'Reconnecting'
                : connectionState === 'polling'
                  ? 'Fallback Active'
                  : 'Connecting'}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--admin-shell-border)] px-3 py-2">
            Updated {formatUpdatedAt(snapshot.generatedAt)}
          </span>
        </div>
      </div>

      {refreshError ? (
        <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          Using the last successful snapshot. {refreshError}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {activeTab === 'overview' ? (
          <>
            <SectionShell
              title="Operational Timeline"
              description={`Live activity across ${snapshot.windowLabel.toLowerCase()}.`}
              icon={Activity}
            >
              <TimelineChart
                points={snapshot.timeline}
                series={[
                  { key: 'reviewVolume', label: 'Workflow', toneClass: 'bg-violet-500' },
                  { key: 'readyDecisions', label: 'Ready', toneClass: 'bg-emerald-500' },
                  { key: 'blockedEditions', label: 'Blocked', toneClass: 'bg-red-500' },
                  { key: 'signIns', label: 'Team', toneClass: 'bg-blue-500' },
                ]}
              />
            </SectionShell>
            <SectionShell
              title="Leadership Load"
              description="What needs attention right now."
              icon={ShieldAlert}
            >
              <HorizontalBars items={snapshot.leadershipLoad} />
            </SectionShell>
            <SectionShell
              title="Content Mix"
              description="Live inventory balance across the publishing surfaces."
              icon={BarChart3}
            >
              <HorizontalBars items={snapshot.contentInventory} />
            </SectionShell>
          </>
        ) : null}

        {activeTab === 'newsroom_ops' ? (
          <>
            <SectionShell
              title="Workflow Timeline"
              description="Review, ready, blocked, and quality movement in the current window."
              icon={Activity}
            >
              <TimelineChart
                points={snapshot.timeline}
                series={[
                  { key: 'reviewVolume', label: 'Workflow', toneClass: 'bg-violet-500' },
                  { key: 'readyDecisions', label: 'Ready', toneClass: 'bg-emerald-500' },
                  { key: 'blockedEditions', label: 'Blocked', toneClass: 'bg-red-500' },
                  { key: 'qualityAlerts', label: 'Quality', toneClass: 'bg-amber-500' },
                ]}
              />
            </SectionShell>
            <SectionShell
              title="Queue By Type"
              description="Which content surfaces are generating the most workflow activity."
              icon={BarChart3}
            >
              <HorizontalBars items={snapshot.queueByType} />
            </SectionShell>
            <SectionShell
              title="Queue Stages"
              description="How the current workflow is distributed across stages."
              icon={ShieldAlert}
            >
              <HorizontalBars items={snapshot.queueStages} />
            </SectionShell>
          </>
        ) : null}

        {activeTab === 'epaper_ops' ? (
          <>
            <SectionShell
              title="Edition Activity"
              description="Blocked, quality, ready, and workflow movement across editions."
              icon={Activity}
            >
              <TimelineChart
                points={snapshot.timeline}
                series={[
                  { key: 'reviewVolume', label: 'Workflow', toneClass: 'bg-violet-500' },
                  { key: 'blockedEditions', label: 'Blocked', toneClass: 'bg-red-500' },
                  { key: 'qualityAlerts', label: 'Quality', toneClass: 'bg-amber-500' },
                  { key: 'readyDecisions', label: 'Ready', toneClass: 'bg-emerald-500' },
                ]}
              />
            </SectionShell>
            <SectionShell
              title="Edition QA Mix"
              description="Current e-paper readiness and quality distribution."
              icon={BarChart3}
            >
              <HorizontalBars items={snapshot.epaperQuality} />
            </SectionShell>
            <SectionShell
              title="Workflow By Stage"
              description="Edition work mapped against the overall queue."
              icon={ShieldAlert}
            >
              <HorizontalBars items={snapshot.queueStages} />
            </SectionShell>
          </>
        ) : null}

        {activeTab === 'audience' ? (
          <>
            <SectionShell
              title="Top Sections"
              description="Reader demand by section based on current page-view activity."
              icon={TrendingUp}
            >
              <HorizontalBars items={snapshot.audienceSections} />
            </SectionShell>
            <SectionShell
              title="Acquisition Channels"
              description="Channels currently driving the most audience activity."
              icon={BarChart3}
            >
              <HorizontalBars items={snapshot.audienceChannels} />
            </SectionShell>
            <SectionShell
              title="Reader Sources"
              description="Live source mix from the current audience instrumentation."
              icon={Activity}
            >
              <HorizontalBars items={snapshot.audienceSources} />
            </SectionShell>
          </>
        ) : null}

        {activeTab === 'team' ? (
          <>
            <SectionShell
              title="Team Sign-In Timeline"
              description="Recent sign-ins across the selected reporting window."
              icon={Activity}
            >
              <TimelineChart
                points={snapshot.timeline}
                series={[
                  { key: 'signIns', label: 'Sign-Ins', toneClass: 'bg-blue-500' },
                  { key: 'reviewVolume', label: 'Workflow', toneClass: 'bg-violet-500' },
                ]}
              />
            </SectionShell>
            <SectionShell
              title="Role Coverage"
              description="How access is distributed across the admin team."
              icon={BarChart3}
            >
              <HorizontalBars items={snapshot.teamRoles} />
            </SectionShell>
            <SectionShell
              title="Team Status"
              description="Quick read on current availability and onboarding pressure."
              icon={ShieldAlert}
            >
              <HorizontalBars items={snapshot.teamStatus} />
            </SectionShell>
          </>
        ) : null}

        {activeTab === 'content' ? (
          <>
            <SectionShell
              title="Inventory Mix"
              description="How current inventory is spread across content surfaces."
              icon={BarChart3}
            >
              <HorizontalBars items={snapshot.contentInventory} />
            </SectionShell>
            <SectionShell
              title="Workflow By Type"
              description="Which content types are creating active queue pressure."
              icon={Activity}
            >
              <HorizontalBars items={snapshot.queueByType} />
            </SectionShell>
            <SectionShell
              title="Content Timeline"
              description="Workflow and ready activity through the selected window."
              icon={TrendingUp}
            >
              <TimelineChart
                points={snapshot.timeline}
                series={[
                  { key: 'reviewVolume', label: 'Workflow', toneClass: 'bg-violet-500' },
                  { key: 'readyDecisions', label: 'Ready', toneClass: 'bg-emerald-500' },
                  { key: 'blockedEditions', label: 'Blocked', toneClass: 'bg-red-500' },
                ]}
              />
            </SectionShell>
          </>
        ) : null}

        {activeTab === 'growth' ? (
          <>
            <SectionShell
              title="Section Momentum"
              description="Sections currently pulling the strongest audience response."
              icon={TrendingUp}
            >
              <HorizontalBars items={snapshot.audienceSections} />
            </SectionShell>
            <SectionShell
              title="Channel Momentum"
              description="Channels generating the strongest current demand."
              icon={BarChart3}
            >
              <HorizontalBars items={snapshot.audienceChannels} />
            </SectionShell>
            <SectionShell
              title="Section Conversion"
              description="Best converting sections from the current audience window."
              icon={ShieldAlert}
            >
              <HorizontalBars items={snapshot.conversionSections} valueSuffix="%" />
            </SectionShell>
          </>
        ) : null}

        {activeTab === 'system_health' ? (
          <>
            <SectionShell
              title="Service Status"
              description="Current service health split across healthy, watch, critical, and inactive."
              icon={ShieldAlert}
            >
              <ServiceStatusStack items={snapshot.serviceStates} />
            </SectionShell>
            <SectionShell
              title="System Metrics"
              description="Live operational pressure across the system layer."
              icon={BarChart3}
            >
              <HorizontalBars items={snapshot.systemMetrics} />
            </SectionShell>
            <SectionShell
              title="Failure Timeline"
              description="Recent runtime failures and related operational pressure."
              icon={Activity}
            >
              <TimelineChart
                points={snapshot.timeline}
                series={[
                  { key: 'failures', label: 'Failures', toneClass: 'bg-red-500' },
                  { key: 'blockedEditions', label: 'Blocked', toneClass: 'bg-amber-500' },
                  { key: 'qualityAlerts', label: 'Quality', toneClass: 'bg-violet-500' },
                ]}
              />
            </SectionShell>
          </>
        ) : null}
      </div>
    </section>
  );
}
