import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { canCreateEpaper } from '@/lib/auth/permissions';
import {
  getCityNameFromSlug,
  normalizeCitySlug,
} from '@/lib/constants/epaperCities';
import { parsePublishDate } from '@/lib/utils/epaperStorage';
import {
  createEpaperAssetUploadTarget,
  parseEpaperAssetSize,
  validateEpaperAssetSelection,
} from '@/lib/storage/epaperAssetUpload';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSessionFromReq(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canCreateEpaper(admin.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const citySlug = normalizeCitySlug(String(body.citySlug || ''));
    const cityName = getCityNameFromSlug(citySlug);
    const title = String(body.title || '').trim();
    const publishDate = parsePublishDate(String(body.publishDate || ''));
    const pageCount = Math.max(
      0,
      Math.floor(Number.parseInt(String(body.pageCount || 0), 10) || 0)
    );

    if (!citySlug || !cityName || !title || !publishDate) {
      return NextResponse.json(
        { success: false, error: 'Valid city, title, and publish date are required.' },
        { status: 400 }
      );
    }
    if (pageCount > 1000) {
      return NextResponse.json({ success: false, error: 'pageCount must be <= 1000.' }, { status: 400 });
    }

    const uploadInput = {
      kind: 'epaper_pdf' as const,
      fileName: String(body.fileName || '').trim(),
      fileType: String(body.fileType || '').trim(),
      fileSize: parseEpaperAssetSize(body.fileSize),
      citySlug,
      publishDate: publishDate.toISOString().slice(0, 10),
    };
    const validationError = validateEpaperAssetSelection(uploadInput);
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    }

    await connectDB();
    const existing = await EPaper.findOne({
      citySlug,
      publishDate,
      isCurrentRevision: true,
    })
      .select('_id')
      .lean();
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'An edition already exists for this city and date.' },
        { status: 409 }
      );
    }

    const familyId = crypto.randomUUID();
    const uploadTarget = createEpaperAssetUploadTarget(uploadInput);
    const pages = Array.from({ length: pageCount }, (_, index) => ({
      pageNumber: index + 1,
      imagePath: '',
      pageType: 'editorial',
      processingStatus: 'pending',
      reviewStatus: 'pending',
    }));
    const epaper = await EPaper.create({
      citySlug,
      cityName,
      title,
      publishDate,
      pdfPath: '',
      pdfPublicId: uploadTarget.mediaKey,
      thumbnailPath: '',
      pageCount,
      pages,
      status: 'draft',
      familyId,
      revisionNumber: 1,
      isCurrentRevision: true,
      productionStatus: 'draft_upload',
      sourceType: 'manual-upload',
      sourceLabel: 'Direct Spaces upload',
    });
    return NextResponse.json(
      {
        success: true,
        data: {
          epaperId: String(epaper._id),
          familyId,
          uploadTarget,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to initialize e-paper upload:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to initialize e-paper upload.' },
      { status: 500 }
    );
  }
}
