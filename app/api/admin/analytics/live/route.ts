import { NextRequest, NextResponse } from 'next/server';
import {
  getAnalyticsCenterData,
  type AnalyticsCompareMode,
  type AnalyticsDateRange,
} from '@/lib/admin/analyticsCenter';
import { buildAnalyticsLiveChartsSnapshot } from '@/lib/admin/analyticsLiveCharts';
import { getAdminSession } from '@/lib/auth/admin';
import { canViewPage } from '@/lib/auth/permissions';

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
  const analytics = await getAnalyticsCenterData({ range, compare });
  const snapshot = buildAnalyticsLiveChartsSnapshot(analytics);

  return NextResponse.json(
    {
      success: true,
      snapshot,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
