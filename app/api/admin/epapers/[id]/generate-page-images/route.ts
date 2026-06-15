import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { canEditEpaper } from '@/lib/auth/permissions';

export async function POST(request: NextRequest) {
  const admin = await getAdminSessionFromReq(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }
  if (!canEditEpaper(admin.role)) {
    return NextResponse.json(
      { success: false, error: 'Forbidden' },
      { status: 403 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error:
        'This endpoint has been replaced by background processing. Use the processing retry endpoint.',
    },
    { status: 410 }
  );
}
