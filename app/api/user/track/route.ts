import { Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db/mongoose';
import User from '@/lib/models/User';

type SessionIdentity = {
  userId: string;
  email: string;
};

type LeanReadHistoryEntry = {
  completionPercent?: number;
};

type LeanTrackedUser = {
  _id: Types.ObjectId;
  readCount?: number;
  readHistory?: LeanReadHistoryEntry[];
  lastActiveAt?: Date;
};

function clampCompletionPercent(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

async function getSessionIdentity() {
  const session = await auth();
  const sessionUser = session?.user;
  const email = sessionUser?.email?.trim().toLowerCase() || '';
  const userId = (sessionUser?.userId || sessionUser?.id || '').trim();

  if (!sessionUser || !email) {
    return null;
  }

  const identity: SessionIdentity = { userId, email };
  return identity;
}

function toUserQuery(identity: SessionIdentity) {
  return Types.ObjectId.isValid(identity.userId)
    ? { _id: identity.userId }
    : { email: identity.email };
}

function toIsoStringOrEmpty(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return '';
}

function calculateAverageCompletion(readHistory: LeanReadHistoryEntry[] = []) {
  if (!readHistory.length) return 0;

  const total = readHistory.reduce((sum, entry) => {
    const next = Number(entry.completionPercent);
    return Number.isFinite(next) ? sum + next : sum;
  }, 0);

  return Math.round(total / readHistory.length);
}

export async function GET() {
  try {
    const identity = await getSessionIdentity();
    if (!identity) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const user = await User.findOne(toUserQuery(identity))
      .select('_id readCount readHistory lastActiveAt')
      .lean<LeanTrackedUser | null>();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const readHistory = Array.isArray(user.readHistory) ? user.readHistory : [];
    const readCount =
      typeof user.readCount === 'number' && Number.isFinite(user.readCount)
        ? user.readCount
        : 0;
    const averageCompletionPercent = calculateAverageCompletion(readHistory);

    return NextResponse.json({
      success: true,
      data: {
        userId: user._id.toString(),
        readCount,
        readHistoryCount: readHistory.length,
        averageCompletionPercent,
        lastActiveAt: toIsoStringOrEmpty(user.lastActiveAt),
      },
    });
  } catch (error) {
    console.error('Failed to load user reading stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load user reading stats' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const identity = await getSessionIdentity();

    // Guest traffic is valid for public reading; tracking is a no-op without session.
    if (!identity) {
      return NextResponse.json({ success: true, skipped: true, reason: 'guest' });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid request payload' },
        { status: 400 }
      );
    }

    const articleId = String(body.articleId || '').trim();
    if (!articleId || !Types.ObjectId.isValid(articleId)) {
      return NextResponse.json(
        { success: false, error: 'Valid articleId is required' },
        { status: 400 }
      );
    }

    const completionPercent = clampCompletionPercent(body.completionPercent);
    const now = new Date();

    await connectDB();

    const updatedUser = await User.findOneAndUpdate(
      toUserQuery(identity),
      {
        $inc: { readCount: 1 },
        $push: {
          readHistory: {
            $each: [
              {
                articleId: new Types.ObjectId(articleId),
                readAt: now,
                completionPercent,
              },
            ],
            $slice: -50,
          },
        },
        $set: { lastActiveAt: now },
      },
      {
        new: true,
        projection: { _id: 1, readCount: 1, lastActiveAt: 1 },
      }
    ).lean<{
      _id: Types.ObjectId;
      readCount?: number;
      lastActiveAt?: Date;
    } | null>();

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          userId: updatedUser._id.toString(),
          readCount:
            typeof updatedUser.readCount === 'number' ? updatedUser.readCount : 0,
          lastActiveAt: updatedUser.lastActiveAt?.toISOString() || now.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to track user read event:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to track user read event' },
      { status: 500 }
    );
  }
}

