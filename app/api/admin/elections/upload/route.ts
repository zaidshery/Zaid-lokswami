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

    // Read formData once
    let formData;
    try {
      formData = await req.formData();
    } catch (err) {
      console.error('[election-upload] Failed to parse form data:', err);
      return NextResponse.json({ success: false, error: 'Failed to parse form data' }, { status: 400 });
    }

    const file     = formData.get('file');
    const stateId  = formData.get('stateId') as string;

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (!VALID_STATE_IDS.includes(stateId)) {
      return NextResponse.json({ success: false, error: 'Invalid state ID' }, { status: 400 });
    }

    // Convert to buffer
    let buffer;
    try {
      buffer = Buffer.from(await file.arrayBuffer());
    } catch (err) {
      console.error('[election-upload] Failed to read file buffer:', err);
      return NextResponse.json({ success: false, error: 'Failed to read file' }, { status: 500 });
    }

    // Ensure /public/elections/ exists
    const electionsDir = path.join(process.cwd(), 'public', 'elections');
    try {
      await fs.mkdir(electionsDir, { recursive: true });
    } catch (err) {
      console.error('[election-upload] Failed to create directory:', err);
      return NextResponse.json({ success: false, error: 'Storage error (dir)' }, { status: 500 });
    }

    // Always save as .jpg
    const filePath = path.join(electionsDir, `${stateId}.jpg`);
    try {
      await fs.writeFile(filePath, buffer);
    } catch (err) {
      console.error('[election-upload] Failed to write file:', err);
      return NextResponse.json({ success: false, error: 'Storage error (write)' }, { status: 500 });
    }

    console.log(`[election-upload] Successfully updated ${stateId} graphic`);

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${stateId} election graphic.`,
      url: `/elections/${stateId}.jpg?t=${Date.now()}`,
    });

  } catch (error: any) {
    console.error('[election-upload] Unexpected error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
