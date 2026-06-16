import { Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { canCreateEpaper } from '@/lib/auth/permissions';
import { verifyEpaperAssetUpload } from '@/lib/storage/epaperAssetUpload';
import {
  isEpaperBackgroundProcessingEnabled,
  queueEpaperPageProcessing,
} from '@/lib/server/epaperProcessingJobs';
import {
  downloadVerifiedEpaperPdf,
  getPdfPageCountFromBuffer,
} from '@/lib/server/epaperPdfRenderer';
import {
  buildEpaperActivityMessage,
  recordEpaperActivity,
} from '@/lib/server/epaperActivity';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const admin = await getAdminSessionFromReq(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canCreateEpaper(admin.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid e-paper ID.' }, { status: 400 });
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const asset = await verifyEpaperAssetUpload({
      kind: 'epaper_pdf',
      mediaKey: String(body.mediaKey || ''),
      expectedSize: Number(body.expectedSize || 0),
      expectedFileType: String(body.expectedFileType || ''),
      expectedFileName: String(body.expectedFileName || ''),
    });
    const pdfBuffer = await downloadVerifiedEpaperPdf(asset.mediaUrl);
    const pageCount = await getPdfPageCountFromBuffer(pdfBuffer);
    if (pageCount < 1 || pageCount > 1000) {
      return NextResponse.json(
        { success: false, error: 'The uploaded PDF must contain between 1 and 1000 pages.' },
        { status: 400 }
      );
    }

    await connectDB();
    const epaper = await EPaper.findById(id);
    if (!epaper) {
      return NextResponse.json({ success: false, error: 'E-paper not found.' }, { status: 404 });
    }
    // Published editions are no longer strictly immutable
    if (!isEpaperBackgroundProcessingEnabled(epaper.citySlug)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Background PDF processing is not enabled for this city.',
        },
        { status: 409 }
      );
    }

    epaper.pdfPath = asset.mediaUrl;
    epaper.pdfPublicId = asset.mediaKey;
    epaper.pdfFormat = 'pdf';
    epaper.sourceUrl = asset.mediaUrl;
    epaper.pageCount = pageCount;
    epaper.pages = Array.from({ length: pageCount }, (_, index) => {
      const existing = epaper.pages.find((page) => page.pageNumber === index + 1);
      return {
        pageNumber: index + 1,
        imagePath: existing?.imagePath || '',
        width: existing?.width,
        height: existing?.height,
        pageType: existing?.pageType || 'editorial',
        classificationNote: existing?.classificationNote || '',
        processingStatus: existing?.imagePath ? 'ready' : 'pending',
        processingError: '',
        processedAt: existing?.processedAt || null,
        reviewStatus: 'pending',
        reviewNote: '',
        reviewedAt: null,
        reviewedBy: null,
      };
    });
    await epaper.save();

    const job = await queueEpaperPageProcessing({
      epaperId: id,
      pageNumbers: Array.from({ length: pageCount }, (_, index) => index + 1),
    });
    await recordEpaperActivity({
      epaperId: id,
      actor: admin,
      action: 'pdf_processing_queued',
      message: buildEpaperActivityMessage({ action: 'pdf_processing_queued' }),
      metadata: { jobId: String(job._id), pageCount },
    });

    return NextResponse.json({
      success: true,
      message: 'PDF verified and queued for background conversion.',
      data: { epaperId: id, jobId: String(job._id), status: job.status },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to finalize upload.';
    console.error('Failed to finalize e-paper upload:', error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
