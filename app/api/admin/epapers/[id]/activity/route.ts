import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import { getAdminSession } from '@/lib/auth/admin';
import { canViewPage } from '@/lib/auth/permissions';
import { listEpaperActivity } from '@/lib/server/epaperActivity';

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI) return true;

  try {
    await connectDB();
    return false;
  } catch (error) {
    console.error('MongoDB unavailable for e-paper activity route.', error);
    return true;
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAdminSession();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canViewPage(user.role, 'epapers')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    if (await shouldUseFileStore()) {
      return NextResponse.json({ success: true, data: [] });
    }

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid e-paper ID' }, { status: 400 });
    }

    const epaper = await EPaper.findById(id)
      .select('_id status productionStatus productionAssignee productionNotes qaCompletedAt updatedAt')
      .lean();

    if (!epaper) {
      return NextResponse.json({ success: false, error: 'E-paper not found' }, { status: 404 });
    }

    const activity = await listEpaperActivity({ epaperId: id, epaper });
    return NextResponse.json({ success: true, data: activity });
  } catch (error) {
    console.error('Failed to fetch e-paper activity:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch e-paper activity' },
      { status: 500 }
    );
  }
}
