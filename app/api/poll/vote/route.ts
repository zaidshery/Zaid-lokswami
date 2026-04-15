import { NextRequest, NextResponse } from 'next/server';
import type { Document } from 'mongoose';
import { Types } from 'mongoose';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db/mongoose';
import Poll from '@/lib/models/Poll';
import PollVote from '@/lib/models/PollVote';
import {
  buildVoterIdentity,
  getClientIp,
  isPollExpired,
  toObjectIdOrNull,
  toPollDTO,
} from '@/lib/server/poll';

class PollVoteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function isDuplicateVoteError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    Number((error as { code?: unknown }).code) === 11000
  );
}

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid request payload' },
        { status: 400 }
      );
    }

    const pollId = String(body.pollId || '').trim();
    const optionIndex = Number.parseInt(String(body.optionIndex ?? ''), 10);

    if (!pollId || !Types.ObjectId.isValid(pollId)) {
      return NextResponse.json(
        { success: false, error: 'Valid pollId is required' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(optionIndex) || optionIndex < 0) {
      return NextResponse.json(
        { success: false, error: 'Valid optionIndex is required' },
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

    const db = await connectDB();
    const txSession = await db.startSession();
    let updatedPoll:
      | (Document & {
          _id: Types.ObjectId;
          question: string;
          options: Array<{ text: string; votes: number }>;
          totalVotes: number;
          status: 'active' | 'inactive';
          expiresAt?: Date | null;
          linkedArticleId?: Types.ObjectId | null;
          createdAt: Date;
          updatedAt: Date;
        })
      | null = null;

    try {
      await txSession.withTransaction(async () => {
        const poll = await Poll.findById(pollId).session(txSession);

        if (!poll) {
          throw new PollVoteError(404, 'Poll not found');
        }

        if (poll.status !== 'active' || isPollExpired(poll.expiresAt)) {
          throw new PollVoteError(409, 'This poll is no longer active.');
        }

        if (optionIndex >= poll.options.length) {
          throw new PollVoteError(400, 'Selected poll option is invalid.');
        }

        const existingVote = await PollVote.findOne({
          pollId: poll._id,
          voterFingerprint: voterIdentity.voterFingerprint,
        }).session(txSession);

        if (existingVote) {
          throw new PollVoteError(409, 'You have already voted in this poll.');
        }

        await PollVote.create(
          [
            {
              pollId: poll._id,
              userId: toObjectIdOrNull(voterIdentity.userId),
              ipAddress: voterIdentity.ipAddress,
              optionIndex,
              voterFingerprint: voterIdentity.voterFingerprint,
            },
          ],
          { session: txSession }
        );

        const optionPath = `options.${optionIndex}.votes`;
        await Poll.updateOne(
          { _id: poll._id },
          {
            $inc: {
              [optionPath]: 1,
              totalVotes: 1,
            },
          },
          { session: txSession }
        );

        updatedPoll = await Poll.findById(poll._id).session(txSession);
      });
    } catch (error) {
      if (error instanceof PollVoteError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: error.status }
        );
      }

      if (isDuplicateVoteError(error)) {
        return NextResponse.json(
          { success: false, error: 'You have already voted in this poll.' },
          { status: 409 }
        );
      }

      throw error;
    } finally {
      await txSession.endSession();
    }

    if (!updatedPoll) {
      return NextResponse.json(
        { success: false, error: 'Failed to update poll results' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: toPollDTO(updatedPoll),
    });
  } catch (error) {
    console.error('Poll vote POST failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit vote' },
      { status: 500 }
    );
  }
}
