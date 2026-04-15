import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db/mongoose';
import Poll from '@/lib/models/Poll';
import PollVote from '@/lib/models/PollVote';
import { buildVoterIdentity, getClientIp } from '@/lib/server/poll';
import type { PollStatusDTO } from '@/lib/types/poll';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pollId = String(searchParams.get('pollId') || '').trim();

    if (!pollId || !Types.ObjectId.isValid(pollId)) {
      return NextResponse.json(
        { success: false, error: 'Valid pollId is required' },
        { status: 400 }
      );
    }

    const session = await auth();
    const sessionUser = session?.user;
    const userId = (sessionUser?.userId || sessionUser?.id || '').trim();
    const voterIdentity = buildVoterIdentity({
      userId,
      ipAddress: getClientIp(req),
      userAgent: req.headers.get('user-agent'),
      acceptLanguage: req.headers.get('accept-language'),
    });

    await connectDB();

    const poll = await Poll.findById(pollId).select('_id').lean();
    if (!poll) {
      return NextResponse.json(
        { success: false, error: 'Poll not found' },
        { status: 404 }
      );
    }

    const vote = await PollVote.findOne({
      pollId: new Types.ObjectId(pollId),
      voterFingerprint: voterIdentity.voterFingerprint,
    })
      .select('optionIndex')
      .lean<{ optionIndex?: number } | null>();

    const data: PollStatusDTO = {
      hasVoted: Boolean(vote),
      selectedOptionIndex:
        vote && typeof vote.optionIndex === 'number' ? vote.optionIndex : null,
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Poll status GET failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load poll status' },
      { status: 500 }
    );
  }
}

