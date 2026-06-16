import { Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { canEditEpaper } from '@/lib/auth/permissions';
import {
  isEpaperBackgroundProcessingEnabled,
  queueEpaperPageProcessing,
  resolveRetryableEpaperPageNumbers,
} from '@/lib/server/epaperProcessingJobs';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await getAdminSessionFromReq(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!canEditEpaper(admin.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: 'Invalid e-paper ID.' }, { status: 400 });
  }

  await connectDB();
  const epaper = await EPaper.findById(id)
    .select('_id citySlug status pageCount pages')
    .lean();
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

  const body = (await request.json().catch(() => ({}))) as { pageNumbers?: unknown };
  const requested = Array.isArray(body.pageNumbers)
    ? body.pageNumbers.map(Number).filter((value) => Number.isFinite(value))
    : [];
  const retryPages = resolveRetryableEpaperPageNumbers(
    epaper.pages || [],
    requested
  );
  if (!retryPages.length) {
    return NextResponse.json(
      { success: false, error: 'There are no missing or failed pages to retry.' },
      { status: 400 }
    );
  }

  const job = await queueEpaperPageProcessing({ epaperId: id, pageNumbers: retryPages });
  return NextResponse.json({
    success: true,
    message: 'Page processing retry queued.',
    data: { jobId: String(job._id), pageNumbers: retryPages },
  });
}
