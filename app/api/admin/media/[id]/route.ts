import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import Media from '@/lib/models/Media';
import fs from 'fs/promises';
import path from 'path';
import { getAdminSession } from '@/lib/auth/admin';
import { canDeleteContent, canViewPage } from '@/lib/auth/permissions';

type MediaRecord = {
  _id?: string;
  filename?: string;
  url?: string;
  size?: number;
  type?: string;
  uploadedBy?: string;
  createdAt?: string | Date;
};

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAdminSession();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    if (!canViewPage(user.role, 'media')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    if (!canDeleteContent(user)) {
      return NextResponse.json(
        { success: false, error: 'Only admins can delete media assets.' },
        { status: 403 }
      );
    }

    if (!process.env.MONGODB_URI) {
      const parts = req.url.split('/');
      const id = parts[parts.length - 1];
      const dataPath = path.resolve(process.cwd(), 'data', 'media.json');
      try {
        const raw = await fs.readFile(dataPath, 'utf-8');
        const parsed = JSON.parse(raw || '[]');
        const medias = Array.isArray(parsed) ? (parsed as MediaRecord[]) : [];
        const idx = medias.findIndex((m) => m._id === id);
        if (idx === -1) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
        medias.splice(idx, 1);
        await fs.writeFile(dataPath, JSON.stringify(medias, null, 2), 'utf-8');
        return NextResponse.json({ success: true });
      } catch {
        return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 });
      }
    }

    await connectDB();
    const urlParts = req.url.split('/');
    const id = urlParts[urlParts.length - 1];
    const media = await Media.findByIdAndDelete(id);
    if (!media) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('media delete err', err);
    return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 });
  }
}
