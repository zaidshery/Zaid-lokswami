import { Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import EPaperProcessingJob from '@/lib/models/EPaperProcessingJob';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { canEditEpaper } from '@/lib/auth/permissions';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
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
  const [epaper, job] = await Promise.all([
    EPaper.findById(id)
      .select('_id pageCount pages productionStatus updatedAt')
      .lean(),
    EPaperProcessingJob.findOne({ epaperId: id }).sort({ createdAt: -1 }).lean(),
  ]);
  if (!epaper) {
    return NextResponse.json({ success: false, error: 'E-paper not found.' }, { status: 404 });
  }
  const warningHours = Math.max(
    1,
    Number(process.env.EPAPER_STUCK_WARNING_HOURS || 6)
  );
  const updatedAt = new Date(epaper.updatedAt);
  const ageMs = Date.now() - updatedAt.getTime();
  const isStale = Number.isFinite(ageMs) && ageMs > warningHours * 60 * 60 * 1000;
  const isProcessing =
    job?.status === 'queued' || job?.status === 'processing';
  const productionStatus =
    epaper.productionStatus === 'qa_review'
      ? 'hotspot_mapping'
      : epaper.productionStatus;
  const stuckWarning =
    isStale && isProcessing
      ? `This edition has been processing for more than ${warningHours} hours.`
      : isStale && productionStatus === 'hotspot_mapping'
        ? `This edition has remained in hotspot mapping for more than ${warningHours} hours.`
        : '';

  return NextResponse.json({
    success: true,
    data: {
      job,
      pageCount: epaper.pageCount,
      pages: epaper.pages,
      productionStatus,
      updatedAt: epaper.updatedAt,
      stuckWarning,
    },
  });
}
