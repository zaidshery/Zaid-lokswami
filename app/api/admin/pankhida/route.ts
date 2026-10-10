import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { canManageNewsroomSettings } from '@/lib/auth/permissions';
import { normalizePankhidaConfig, validatePankhidaConfig } from '@/lib/pankhida/config';
import { readPankhidaConfig, writePankhidaConfig } from '@/lib/pankhida/storage';

export async function GET(req: NextRequest) {
  const user = await getAdminSessionFromReq(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageNewsroomSettings(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json(await readPankhidaConfig());
}

export async function PUT(req: NextRequest) {
  const user = await getAdminSessionFromReq(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageNewsroomSettings(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const config = normalizePankhidaConfig(await req.json());
    const error = validatePankhidaConfig(config);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json(await writePankhidaConfig(config));
  } catch (error) {
    console.error('Failed to save Pankhida stream settings.', error);
    return NextResponse.json({ error: 'Could not save Pankhida stream settings.' }, { status: 500 });
  }
}
