import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { canManageNewsroomSettings } from '@/lib/auth/permissions';
import { readElectionResultsData, writeElectionResultsData } from '@/lib/elections/storage';

export async function GET(req: NextRequest) {
  const user = await getAdminSessionFromReq(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageNewsroomSettings(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json(await readElectionResultsData());
}

export async function POST(req: NextRequest) {
  const user = await getAdminSessionFromReq(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageNewsroomSettings(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const data = await writeElectionResultsData(body);

  return NextResponse.json({ success: true, lastUpdated: data.lastUpdated });
}
