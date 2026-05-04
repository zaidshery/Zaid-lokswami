import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { promises as fs } from 'fs';
import path from 'path';

const VALID_STATE_IDS = ['wb', 'kerala', 'tn', 'assam', 'puducherry'];

export async function POST(req: NextRequest) {
  try {
    const user = await getAdminSessionFromReq(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let formData;
    try {
      formData = await req.formData();
    } catch (error) {
      const clonedReq = req.clone();
      formData = await clonedReq.formData();
    }

    const file = formData.get('file');
    const stateId = formData.get('stateId') as string;

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (!VALID_STATE_IDS.includes(stateId)) {
      return NextResponse.json({ success: false, error: 'Invalid state ID' }, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Ensure directory exists
    const electionsDir = path.join(process.cwd(), 'public', 'elections');
    try {
      await fs.access(electionsDir);
    } catch {
      await fs.mkdir(electionsDir, { recursive: true });
    }

    // Save file, overwriting existing
    const filePath = path.join(electionsDir, `${stateId}.jpg`);
    await fs.writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${stateId} election graphic.`,
      url: `/elections/${stateId}.jpg?t=${Date.now()}`
    });

  } catch (error) {
    console.error('Error uploading election graphic:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
