import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromReq } from '@/lib/auth/admin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const admin = await getAdminSessionFromReq(req);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(
    {
      success: false,
      error:
        'Direct DigitalOcean upload is required for e-paper files. Please use the updated CMS upload screen.',
    },
    { status: 400 }
  );
}
