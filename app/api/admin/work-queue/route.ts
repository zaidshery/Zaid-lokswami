import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin';
import { canViewPage } from '@/lib/auth/permissions';
import { getWorkQueueOverview, type WorkQueueView } from '@/lib/admin/workQueue';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  if (!canViewPage(admin.role, 'work_queue')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const overview = await getWorkQueueOverview(admin, {
    view: params.get('view') as WorkQueueView | undefined,
    contentType: params.get('contentType') as never,
    status: params.get('status') as never,
    priority: params.get('priority') as never,
    assignee: params.get('assignee') || undefined,
    search: params.get('search') || undefined,
    sort: params.get('sort') as never,
    cursor: params.get('cursor') || undefined,
    limit: Number(params.get('limit') || 30),
  });

  return NextResponse.json({ success: true, data: overview });
}
