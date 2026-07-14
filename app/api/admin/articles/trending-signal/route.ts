import { NextRequest, NextResponse } from 'next/server';
import { getAudienceAnalyticsSummary } from '@/lib/admin/audienceAnalytics';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { canViewPage } from '@/lib/auth/permissions';

function normalized(value: string) {
  return value.trim().toLocaleLowerCase('en-IN');
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAdminSessionFromReq(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canViewPage(user.role, 'article_create')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const category = new URL(req.url).searchParams.get('category')?.trim() || '';
    if (!category) {
      return NextResponse.json({
        success: true,
        data: {
          available: false,
          reason: '',
          detail: 'Choose a category before checking its audience signal.',
        },
      });
    }

    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    const previousEnd = new Date(start);
    const previousStart = new Date(start);
    previousStart.setDate(previousStart.getDate() - 7);
    const analytics = await getAudienceAnalyticsSummary({
      start,
      end,
      previousStart,
      previousEnd,
    });
    const trend = analytics.current.sectionTrends.find(
      (item) => normalized(item.label) === normalized(category)
    );

    if (!trend || trend.currentEvents <= 0) {
      return NextResponse.json({
        success: true,
        data: {
          available: false,
          reason: '',
          detail: `No seven-day audience signal is available for ${category}.`,
        },
      });
    }

    const movement =
      trend.deltaEvents === 0
        ? 'unchanged from the previous seven days'
        : `${trend.deltaEvents > 0 ? '+' : ''}${trend.deltaEvents} versus the previous seven days`;
    const reason = `Audience analytics: ${category} recorded ${trend.currentEvents} page views across ${trend.currentSessions} sessions in the last 7 days (${movement}).`;

    return NextResponse.json({
      success: true,
      data: {
        available: true,
        reason,
        detail: `Source: ${analytics.source}; refreshed ${end.toISOString()}.`,
        signal: trend,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load audience signal',
      },
      { status: 500 }
    );
  }
}
