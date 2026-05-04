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

    // Read formData once — never clone the request (breaks in Next.js 15)
    const formData = await req.formData();
    const file     = formData.get('file');
    const stateId  = formData.get('stateId') as string;

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (!VALID_STATE_IDS.includes(stateId)) {
      return NextResponse.json({ success: false, error: 'Invalid state ID' }, { status: 400 });
    }

    // Convert to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Ensure /public/elections/ exists
    const electionsDir = path.join(process.cwd(), 'public', 'elections');
    await fs.mkdir(electionsDir, { recursive: true });

    // Always save as .jpg (widget references <stateId>.jpg)
    const filePath = path.join(electionsDir, `${stateId}.jpg`);
    await fs.writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${stateId} election graphic.`,
      url: `/elections/${stateId}.jpg?t=${Date.now()}`,
    });

  } catch (error) {
    console.error('[election-upload]', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
