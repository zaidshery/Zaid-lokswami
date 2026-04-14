import { NextRequest, NextResponse } from 'next/server';
import {
  getAnalyticsCenterData,
  type AnalyticsCompareMode,
  type AnalyticsDateRange,
} from '@/lib/admin/analyticsCenter';
import { buildAnalyticsLiveChartsSnapshot } from '@/lib/admin/analyticsLiveCharts';
import { getAdminSession } from '@/lib/auth/admin';
import { canViewPage } from '@/lib/auth/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseRange(value: string | null): AnalyticsDateRange {
  return ['today', '7d', '30d', '90d'].includes(String(value || ''))
    ? (value as AnalyticsDateRange)
    : '30d';
}

function parseCompare(value: string | null): AnalyticsCompareMode {
  return value === 'previous' ? 'previous' : 'off';
}

export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!canViewPage(admin.role, 'analytics')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const range = parseRange(searchParams.get('range'));
  const compare = parseCompare(searchParams.get('compare'));
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let snapshotInterval: ReturnType<typeof setInterval> | null = null;
      let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

      const enqueue = (value: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(value));
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (snapshotInterval) clearInterval(snapshotInterval);
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        try {
          controller.close();
        } catch {}
      };

      const sendSnapshot = async () => {
        try {
          const analytics = await getAnalyticsCenterData({ range, compare });
          const snapshot = buildAnalyticsLiveChartsSnapshot(analytics);
          enqueue(`event: snapshot\ndata: ${JSON.stringify({ success: true, snapshot })}\n\n`);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to build analytics live snapshot.';
          enqueue(`event: error\ndata: ${JSON.stringify({ success: false, error: message })}\n\n`);
        }
      };

      enqueue(`retry: 5000\n\n`);
      void sendSnapshot();

      snapshotInterval = setInterval(() => {
        void sendSnapshot();
      }, 30000);

      heartbeatInterval = setInterval(() => {
        enqueue(`: heartbeat ${Date.now()}\n\n`);
      }, 15000);

      req.signal.addEventListener('abort', cleanup);
    },
    cancel() {
      return;
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
