import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin';
import { canViewPage } from '@/lib/auth/permissions';
import { processQueuedTtsAssets } from '@/lib/server/ttsAssets';

function hasCronSecret(request: NextRequest) {
  const expected = process.env.ADMIN_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  if (!expected) return false;
  return request.headers.get('x-cron-secret')?.trim() === expected;
}

async function canRunWorker(request: NextRequest) {
  if (hasCronSecret(request)) return true;

  const admin = await getAdminSession();
  return Boolean(admin && canViewPage(admin.role, 'ai_ops'));
}

export async function POST(request: NextRequest) {
  if (!(await canRunWorker(request))) {
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden',
        code: 'FORBIDDEN',
      },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { limit?: unknown };
  const rawLimit = typeof body.limit === 'number' ? body.limit : Number(body.limit || 5);
  const limit = Number.isFinite(rawLimit) ? rawLimit : 5;
  const summary = await processQueuedTtsAssets({ limit });

  return NextResponse.json({
    success: true,
    data: summary,
  });
}

