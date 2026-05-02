import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import Media from '@/lib/models/Media';
import fs from 'fs/promises';
import path from 'path';
  getAdminSession,
  getAdminSessionFromReq,
  type AdminSessionIdentity,
} from '@/lib/auth/admin';
import { canDeleteContent, canViewPage } from '@/lib/auth/permissions';
import { isReporterDeskRole } from '@/lib/auth/roles';

type MediaRecord = {
  _id?: string;
  filename: string;
  url: string;
  size?: number;
  type?: string;
  uploadedBy?: string;
  createdAt?: string | Date;
};

function filterMediaForUser(records: MediaRecord[], user: AdminSessionIdentity): MediaRecord[] {
  if (!isReporterDeskRole(user.role)) {
    return records;
  }

  const normalizedEmail = user.email.trim().toLowerCase();

  return records.filter((record) => record.uploadedBy?.trim().toLowerCase() === normalizedEmail);
}

function sortMediaByCreatedAt(records: MediaRecord[]): MediaRecord[] {
  return [...records].sort((left, right) => {
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAdminSessionFromReq(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!canViewPage(user.role, 'media')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (!process.env.MONGODB_URI) {
      const dataPath = path.resolve(process.cwd(), 'data', 'media.json');
      try {
        const raw = await fs.readFile(dataPath, 'utf-8');
        const parsed = JSON.parse(raw || '[]');
        const medias = Array.isArray(parsed) ? (parsed as MediaRecord[]) : [];
        const scopedMedia = sortMediaByCreatedAt(filterMediaForUser(medias, user));
        return NextResponse.json({
          success: true,
          data: scopedMedia,
          meta: {
            scope: isReporterDeskRole(user.role) ? 'own' : 'all',
            canDelete: canDeleteContent(user),
          },
        });
      } catch {
        return NextResponse.json({ success: true, data: [] });
      }
    }

    await connectDB();
    const query = isReporterDeskRole(user.role) ? { uploadedBy: user.email } : {};
    const medias = await Media.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json({
      success: true,
      data: medias,
      meta: {
        scope: isReporterDeskRole(user.role) ? 'own' : 'all',
        canDelete: canDeleteContent(user),
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to list media' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAdminSessionFromReq(req);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    if (!canViewPage(user.role, 'media')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { filename, url, size, type } = body;
    if (!filename || !url) return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });

    if (!process.env.MONGODB_URI) {
      const dataDir = path.resolve(process.cwd(), 'data');
      await fs.mkdir(dataDir, { recursive: true });
      const dataPath = path.join(dataDir, 'media.json');
      let medias: MediaRecord[] = [];
      try {
        const raw = await fs.readFile(dataPath, 'utf-8');
        const parsed = JSON.parse(raw || '[]');
        medias = Array.isArray(parsed) ? (parsed as MediaRecord[]) : [];
      } catch {}
      const newMedia = { _id: Date.now().toString(), filename, url, size: size || 0, type: type || 'image/*', uploadedBy: user.email || 'admin', createdAt: new Date() };
      medias.push(newMedia);
      await fs.writeFile(dataPath, JSON.stringify(medias, null, 2), 'utf-8');
      return NextResponse.json({ success: true, data: newMedia }, { status: 201 });
    }

    await connectDB();
    const media = new Media({ filename, url, size: size || 0, type: type || 'image/*', uploadedBy: user.email || 'admin' });
    await media.save();
    return NextResponse.json({ success: true, data: media }, { status: 201 });
  } catch (error) {
    console.error('media create error', error);
    return NextResponse.json({ success: false, error: 'Failed to create media' }, { status: 500 });
  }
}

