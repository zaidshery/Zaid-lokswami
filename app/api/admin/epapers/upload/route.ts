import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import { getAdminSession } from '@/lib/auth/admin';
import EPaper from '@/lib/models/EPaper';
import {
  ADMIN_EPAPER_LIMIT_ERROR,
  MAX_ADMIN_EPAPERS,
} from '@/lib/constants/adminContentLimits';
import {
  createAdminEpaperFromFiles,
  isFile,
  mapAdminEpaper,
  parseOptionalPageCount,
} from '@/lib/utils/adminEpaperIngestion';

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const existingTotal = await EPaper.countDocuments({});
    if (existingTotal >= MAX_ADMIN_EPAPERS) {
      return NextResponse.json(
        { success: false, error: ADMIN_EPAPER_LIMIT_ERROR },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const pdf = formData.get('pdf');
    const thumbnail = formData.get('thumbnail');

    if (!isFile(pdf) || pdf.size <= 0) {
      return NextResponse.json(
        { success: false, error: 'PDF file is required' },
        { status: 400 }
      );
    }
    if (!isFile(thumbnail) || thumbnail.size <= 0) {
      return NextResponse.json(
        { success: false, error: 'Thumbnail file is required' },
        { status: 400 }
      );
    }

    const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
    const pageImageFiles = formData
      .getAll('pageImages')
      .filter(isFile)
      .filter((file) => file.size > 0)
      .sort((left, right) => collator.compare(left.name || '', right.name || ''));

    const result = await createAdminEpaperFromFiles({
      citySlug: String(formData.get('citySlug') || ''),
      cityName: String(formData.get('cityName') || ''),
      title: String(formData.get('title') || ''),
      publishDateInput: String(formData.get('publishDate') || ''),
      optionalPageCount: parseOptionalPageCount(String(formData.get('pageCount') || '')),
      statusInput: String(formData.get('status') || ''),
      pdfFile: pdf,
      thumbnailFile: thumbnail,
      pageImageFiles,
      sourceType: 'manual-upload',
      sourceLabel: 'Manual upload',
    });

    return NextResponse.json(
      {
        success: true,
        message: 'E-paper uploaded successfully',
        warning: result.warning,
        data: mapAdminEpaper(result.epaper.toObject()),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error && error.message.trim()
      ? error.message
      : 'Failed to upload e-paper';
    const status =
      /already exists/i.test(message)
        ? 409
        : /required|must be|could not infer|too high|max|valid/i.test(message)
          ? 400
          : 500;

    console.error('Failed to upload e-paper:', error);
    return NextResponse.json(
      {
        success: false,
        error: status === 500 ? 'Failed to upload e-paper' : message,
      },
      { status }
    );
  }
}
