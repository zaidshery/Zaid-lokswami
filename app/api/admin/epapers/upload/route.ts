import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import {
  createAdminEpaperFromFiles,
  isFile,
  mapAdminEpaper,
  parseOptionalPageCount,
} from '@/lib/utils/adminEpaperIngestion';

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminSessionFromReq(req);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Clone request to avoid "body locked" error when accessed by middleware
    let formData;
    try {
      formData = await req.formData();
    } catch (bodyError) {
      // If body is locked/disturbed, try cloning the request
      const isBodyError = bodyError instanceof Error &&
        (bodyError.message.includes('disturbed') || bodyError.message.includes('locked'));
      const isTimeoutError = bodyError && typeof bodyError === 'object' && 'code' in bodyError &&
        (bodyError as { code?: string }).code === 'ERR_HTTP_REQUEST_TIMEOUT';
      if (isBodyError || isTimeoutError) {
        try {
          const clonedReq = req.clone();
          formData = await clonedReq.formData();
        } catch (cloneError) {
          console.error('Failed to read form data after cloning:', cloneError);
          return NextResponse.json(
            { success: false, error: 'Failed to process request body' },
            { status: 400 }
          );
        }
      } else {
        throw bodyError;
      }
    }
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

    await connectDB();

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
