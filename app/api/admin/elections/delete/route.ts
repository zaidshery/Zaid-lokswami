import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { promises as fs } from 'fs';
import path from 'path';

const VALID_STATE_IDS = ['wb', 'kerala', 'tn', 'assam', 'puducherry'];

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAdminSessionFromReq(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { stateId } = await req.json();

    if (!stateId || !VALID_STATE_IDS.includes(stateId)) {
      return NextResponse.json({ success: false, error: 'Invalid state ID' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'public', 'elections', `${stateId}.jpg`);

    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
    } catch {
      // File doesn't exist — treat as success (idempotent)
    }

    return NextResponse.json({ success: true, message: `Deleted ${stateId} election graphic.` });
  } catch (error) {
    console.error('Error deleting election graphic:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
