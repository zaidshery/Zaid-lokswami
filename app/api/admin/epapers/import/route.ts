import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import { getAdminSession } from '@/lib/auth/admin';
import {
  createAdminEpaperFromRemoteImport,
  mapAdminEpaper,
} from '@/lib/utils/adminEpaperIngestion';

function normalizePageImageUrls(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [] as string[];
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await req.json().catch(() => ({}));
    const source = typeof body === 'object' && body ? (body as Record<string, unknown>) : {};

    const result = await createAdminEpaperFromRemoteImport({
      citySlug: String(source.citySlug || ''),
      cityName: typeof source.cityName === 'string' ? source.cityName : '',
      title: String(source.title || ''),
      publishDate: String(source.publishDate || ''),
      status:
        String(source.status || '').trim().toLowerCase() === 'published' ? 'published' : 'draft',
      pageCount: Number.parseInt(String(source.pageCount ?? ''), 10) || 0,
      pdfUrl: String(source.pdfUrl || ''),
      thumbnailUrl: String(source.thumbnailUrl || ''),
      pageImageUrls: normalizePageImageUrls(source.pageImageUrls),
      sourceLabel: String(source.sourceLabel || ''),
    });

    return NextResponse.json(
      {
        success: true,
        message: 'E-paper imported successfully',
        warning: result.warning,
        data: mapAdminEpaper(result.epaper.toObject()),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error && error.message.trim()
      ? error.message
      : 'Failed to import e-paper';
    const status =
      /already exists/i.test(message)
        ? 409
        : /required|valid|supported|download|timed out|larger than|could not infer|max/i.test(message)
          ? 400
          : 500;

    console.error('Failed to import e-paper:', error);
    return NextResponse.json(
      {
        success: false,
        error: status === 500 ? 'Failed to import e-paper' : message,
      },
      { status }
    );
  }
}
