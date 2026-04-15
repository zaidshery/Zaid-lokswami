import { NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import Poll from '@/lib/models/Poll';
import { toPollDTO } from '@/lib/server/poll';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectDB();

    const now = new Date();
    const poll = await Poll.findOne({
      status: 'active',
      $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
    })
      .sort({ createdAt: -1, _id: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: poll ? toPollDTO(poll, now) : null,
    });
  } catch (error) {
    console.error('Poll current GET failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load current poll' },
      { status: 500 }
    );
  }
}

