import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildLeadershipReportDeliveryPerformanceAlerts } from '@/lib/admin/leadershipReportDeliveryPerformanceAlerts';
import { getLeadershipReportDeliveryTrends } from '@/lib/admin/leadershipReportDeliveryTrends';
import type { LeadershipReportRunHistoryEntry } from '@/lib/storage/leadershipReportRunHistoryFile';
import type { LeadershipReportSchedule } from '@/lib/storage/leadershipReportSchedulesFile';

const listLeadershipReportRunHistoryMock = vi.fn();
const listLeadershipReportSchedulesMock = vi.fn();
const getLeadershipReportCriticalAlertStateMock = vi.fn();
const saveLeadershipReportCriticalAlertStateMock = vi.fn();
const createLeadershipReportAlertNotificationHistoryMock = vi.fn();
const sendLeadershipReportCriticalAlertEmailMock = vi.fn();
const sendLeadershipReportCriticalAlertWebhookMock = vi.fn();

vi.mock('@/lib/storage/leadershipReportRunHistoryFile', () => ({
  listLeadershipReportRunHistory: listLeadershipReportRunHistoryMock,
}));

vi.mock('@/lib/storage/leadershipReportSchedulesFile', async () => {
  const actual = await vi.importActual<typeof import('@/lib/storage/leadershipReportSchedulesFile')>(
    '@/lib/storage/leadershipReportSchedulesFile'
  );

  return {
    ...actual,
    listLeadershipReportSchedules: listLeadershipReportSchedulesMock,
  };
});

vi.mock('@/lib/storage/leadershipReportCriticalAlertStateFile', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/storage/leadershipReportCriticalAlertStateFile')
  >('@/lib/storage/leadershipReportCriticalAlertStateFile');

  return {
    ...actual,
    getLeadershipReportCriticalAlertState: getLeadershipReportCriticalAlertStateMock,
    saveLeadershipReportCriticalAlertState: saveLeadershipReportCriticalAlertStateMock,
  };
});

vi.mock('@/lib/storage/leadershipReportAlertNotificationHistoryFile', () => ({
  createLeadershipReportAlertNotificationHistory:
    createLeadershipReportAlertNotificationHistoryMock,
}));

vi.mock('@/lib/notifications/leadershipReportEmail', async () => {
  const actual = await vi.importActual<typeof import('@/lib/notifications/leadershipReportEmail')>(
    '@/lib/notifications/leadershipReportEmail'
  );

  return {
    ...actual,
    sendLeadershipReportCriticalAlertEmail: sendLeadershipReportCriticalAlertEmailMock,
  };
});

vi.mock('@/lib/notifications/leadershipReportWebhook', async () => {
  const actual = await vi.importActual<typeof import('@/lib/notifications/leadershipReportWebhook')>(
    '@/lib/notifications/leadershipReportWebhook'
  );

  return {
    ...actual,
    sendLeadershipReportCriticalAlertWebhook: sendLeadershipReportCriticalAlertWebhookMock,
  };
});

function createHistory(
  overrides: Partial<LeadershipReportRunHistoryEntry> = {}
): LeadershipReportRunHistoryEntry {
  return {
    id: 'run-1',
    scheduleId: 'daily_briefing',
    label: 'Daily Briefing',
    cadenceLabel: 'Daily',
    deliveryMode: 'dashboard_link',
    webhookProvider: null,
    recipientEmails: [],
    trigger: 'cron',
    actorEmail: null,
    status: 'success',
    summary: 'ok',
    createdAt: '2026-04-06T06:00:00.000Z',
    ...overrides,
  };
}

function createSchedule(
  overrides: Partial<LeadershipReportSchedule> = {}
): LeadershipReportSchedule {
  return {
    id: 'daily_briefing',
    label: 'Daily Briefing',
    description: 'Daily leadership summary.',
    cadenceLabel: 'Daily',
    enabled: true,
    deliveryTime: '08:30',
    timezone: 'Asia/Calcutta',
    deliveryMode: 'email_summary',
    recipientEmails: ['leader@lokswami.com'],
    webhookUrls: [],
    webhookProvider: 'generic_json',
    notes: '',
    lastRunAt: null,
    lastRunStatus: 'idle',
    lastRunSummary: '',
    updatedAt: '2026-04-01T00:00:00.000Z',
    nextPlannedAt: '2026-04-07T03:00:00.000Z',
    viewHref: '/admin/analytics',
    downloadHref: '/api/admin/analytics/briefing?preset=daily_briefing',
    ...overrides,
  };
}

describe('maybeNotifyLeadershipReportCriticalAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-06T12:00:00.000Z'));
    getLeadershipReportCriticalAlertStateMock.mockResolvedValue({
      key: 'critical_performance_alerts',
      activeAlertIds: [],
      lastAlertSignature: '',
      lastNotifiedAt: null,
      updatedAt: '2026-04-01T00:00:00.000Z',
    });
    saveLeadershipReportCriticalAlertStateMock.mockResolvedValue(undefined);
    createLeadershipReportAlertNotificationHistoryMock.mockResolvedValue(undefined);
    sendLeadershipReportCriticalAlertEmailMock.mockResolvedValue({
      sent: true,
      deliveredTo: ['leader@lokswami.com'],
    });
    sendLeadershipReportCriticalAlertWebhookMock.mockResolvedValue({
      sent: true,
      deliveredTo: ['https://hooks.slack.com/services/a/b/c'],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends notifications for newly critical alert sets and persists the signature', async () => {
    listLeadershipReportRunHistoryMock.mockResolvedValue([
      createHistory({ id: 'current-1', status: 'failed', createdAt: '2026-04-06T06:00:00.000Z' }),
      createHistory({ id: 'current-2', status: 'failed', createdAt: '2026-04-05T06:00:00.000Z' }),
      createHistory({ id: 'current-3', status: 'failed', createdAt: '2026-04-04T06:00:00.000Z' }),
      createHistory({ id: 'previous-1', status: 'success', createdAt: '2026-03-28T06:00:00.000Z' }),
      createHistory({ id: 'previous-2', status: 'success', createdAt: '2026-03-27T06:00:00.000Z' }),
      createHistory({ id: 'previous-3', status: 'success', createdAt: '2026-03-26T06:00:00.000Z' }),
    ]);
    listLeadershipReportSchedulesMock.mockResolvedValue([
      createSchedule(),
      createSchedule({
        id: 'weekly_briefing',
        label: 'Weekly Briefing',
        cadenceLabel: 'Weekly',
        deliveryMode: 'webhook_summary',
        recipientEmails: [],
        webhookUrls: ['https://hooks.slack.com/services/a/b/c'],
        webhookProvider: 'slack',
        downloadHref: '/api/admin/analytics/briefing?preset=weekly_briefing',
      }),
    ]);

    const { maybeNotifyLeadershipReportCriticalAlerts } = await import(
      '@/lib/admin/leadershipReportCriticalAlertNotifier'
    );
    const result = await maybeNotifyLeadershipReportCriticalAlerts();

    expect(result.sent).toBe(true);
    expect(result.alertCount).toBeGreaterThan(0);
    expect(sendLeadershipReportCriticalAlertEmailMock).toHaveBeenCalledTimes(1);
    expect(sendLeadershipReportCriticalAlertWebhookMock).toHaveBeenCalledTimes(1);
    expect(createLeadershipReportAlertNotificationHistoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'sent',
        alertCount: expect.any(Number),
      })
    );
    expect(saveLeadershipReportCriticalAlertStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        activeAlertIds: expect.arrayContaining(['success-rate-decline', 'failure-volume-rising']),
      })
    );
  }, 15_000);

  it('skips sending when the same critical alert set was already notified', async () => {
    const history = [
      createHistory({ id: 'current-1', status: 'failed', createdAt: '2026-04-06T06:00:00.000Z' }),
      createHistory({ id: 'current-2', status: 'failed', createdAt: '2026-04-05T06:00:00.000Z' }),
      createHistory({ id: 'current-3', status: 'failed', createdAt: '2026-04-04T06:00:00.000Z' }),
      createHistory({ id: 'previous-1', status: 'success', createdAt: '2026-03-28T06:00:00.000Z' }),
      createHistory({ id: 'previous-2', status: 'success', createdAt: '2026-03-27T06:00:00.000Z' }),
      createHistory({ id: 'previous-3', status: 'success', createdAt: '2026-03-26T06:00:00.000Z' }),
    ];
    listLeadershipReportRunHistoryMock.mockResolvedValue(history);
    listLeadershipReportSchedulesMock.mockResolvedValue([createSchedule()]);
    const signature = buildLeadershipReportDeliveryPerformanceAlerts(
      getLeadershipReportDeliveryTrends(history)
    )
      .filter((alert) => alert.severity === 'critical')
      .map((alert) => `${alert.id}:${alert.detail}`)
      .sort()
      .join('|');
    getLeadershipReportCriticalAlertStateMock.mockResolvedValue({
      key: 'critical_performance_alerts',
      activeAlertIds: ['success-rate-decline', 'failure-volume-rising'],
      lastAlertSignature: signature,
      lastNotifiedAt: '2026-04-06T07:00:00.000Z',
      updatedAt: '2026-04-06T07:00:00.000Z',
    });

    const { maybeNotifyLeadershipReportCriticalAlerts } = await import(
      '@/lib/admin/leadershipReportCriticalAlertNotifier'
    );
    const result = await maybeNotifyLeadershipReportCriticalAlerts();

    expect(result.sent).toBe(false);
    expect(result.skipped).toBe(true);
    expect(sendLeadershipReportCriticalAlertEmailMock).not.toHaveBeenCalled();
    expect(sendLeadershipReportCriticalAlertWebhookMock).not.toHaveBeenCalled();
    expect(createLeadershipReportAlertNotificationHistoryMock).not.toHaveBeenCalled();
  });

  it('skips sending while critical alerts are temporarily muted', async () => {
    listLeadershipReportRunHistoryMock.mockResolvedValue([
      createHistory({ id: 'current-1', status: 'failed', createdAt: '2026-04-06T06:00:00.000Z' }),
      createHistory({ id: 'current-2', status: 'failed', createdAt: '2026-04-05T06:00:00.000Z' }),
      createHistory({ id: 'current-3', status: 'failed', createdAt: '2026-04-04T06:00:00.000Z' }),
      createHistory({ id: 'previous-1', status: 'success', createdAt: '2026-03-28T06:00:00.000Z' }),
      createHistory({ id: 'previous-2', status: 'success', createdAt: '2026-03-27T06:00:00.000Z' }),
      createHistory({ id: 'previous-3', status: 'success', createdAt: '2026-03-26T06:00:00.000Z' }),
    ]);
    listLeadershipReportSchedulesMock.mockResolvedValue([createSchedule()]);
    getLeadershipReportCriticalAlertStateMock.mockResolvedValue({
      key: 'critical_performance_alerts',
      activeAlertIds: ['success-rate-decline'],
      lastAlertSignature: '',
      lastNotifiedAt: '2026-04-06T07:00:00.000Z',
      mutedUntil: '2099-04-06T12:00:00.000Z',
      mutedByEmail: 'boss@lokswami.com',
      mutedReason: 'Muted for 8 hours.',
      updatedAt: '2026-04-06T08:00:00.000Z',
    });

    const { maybeNotifyLeadershipReportCriticalAlerts } = await import(
      '@/lib/admin/leadershipReportCriticalAlertNotifier'
    );
    const result = await maybeNotifyLeadershipReportCriticalAlerts();

    expect(result.sent).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toContain('muted');
    expect(sendLeadershipReportCriticalAlertEmailMock).not.toHaveBeenCalled();
    expect(sendLeadershipReportCriticalAlertWebhookMock).not.toHaveBeenCalled();
    expect(createLeadershipReportAlertNotificationHistoryMock).not.toHaveBeenCalled();
  });
});
