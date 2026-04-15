import type { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();
const connectDBMock = vi.fn();
const startSessionMock = vi.fn();

const pollFindOneMock = vi.fn();
const pollFindByIdMock = vi.fn();
const pollUpdateOneMock = vi.fn();

const pollVoteFindOneMock = vi.fn();
const pollVoteCreateMock = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('@/lib/db/mongoose', () => ({
  default: connectDBMock,
}));

vi.mock('@/lib/models/Poll', () => ({
  default: {
    findOne: pollFindOneMock,
    findById: pollFindByIdMock,
    updateOne: pollUpdateOneMock,
  },
}));

vi.mock('@/lib/models/PollVote', () => ({
  default: {
    findOne: pollVoteFindOneMock,
    create: pollVoteCreateMock,
  },
}));

function createTxSession() {
  return {
    withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
    endSession: vi.fn().mockResolvedValue(undefined),
  };
}

describe('/api/poll routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(null);
    connectDBMock.mockResolvedValue({
      startSession: startSessionMock,
    });
  });

  it('returns null when no non-expired active poll is available', async () => {
    pollFindOneMock.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    });

    const { GET } = await import('@/app/api/poll/current/route');
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      success: true,
      data: null,
    });
  });

  it('returns voted status for the current visitor', async () => {
    const pollId = new Types.ObjectId().toString();

    pollFindByIdMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ _id: pollId }),
      }),
    });
    pollVoteFindOneMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ optionIndex: 1 }),
      }),
    });

    const { GET } = await import('@/app/api/poll/status/route');
    const response = await GET(
      new Request(`http://localhost/api/poll/status?pollId=${pollId}`, {
        headers: {
          'x-forwarded-for': '203.0.113.10',
        },
      }) as unknown as NextRequest
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      success: true,
      data: {
        hasVoted: true,
        selectedOptionIndex: 1,
      },
    });
  });

  it('rejects invalid option indexes during vote submission', async () => {
    const txSession = createTxSession();
    const pollId = new Types.ObjectId().toString();

    startSessionMock.mockResolvedValue(txSession);
    pollFindByIdMock.mockImplementationOnce(() => ({
      session: vi.fn().mockResolvedValue({
        _id: new Types.ObjectId(pollId),
        status: 'active',
        options: [
          { text: 'Yes', votes: 2 },
          { text: 'No', votes: 1 },
        ],
        expiresAt: null,
      }),
    }));

    const { POST } = await import('@/app/api/poll/vote/route');
    const response = await POST(
      new Request('http://localhost/api/poll/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.10',
        },
        body: JSON.stringify({
          pollId,
          optionIndex: 9,
        }),
      }) as unknown as NextRequest
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      success: false,
      error: 'Selected poll option is invalid.',
    });
    expect(pollVoteCreateMock).not.toHaveBeenCalled();
    expect(pollUpdateOneMock).not.toHaveBeenCalled();
  });

  it('rejects duplicate votes for the same visitor fingerprint', async () => {
    const txSession = createTxSession();
    const pollId = new Types.ObjectId().toString();

    startSessionMock.mockResolvedValue(txSession);
    pollFindByIdMock.mockImplementationOnce(() => ({
      session: vi.fn().mockResolvedValue({
        _id: new Types.ObjectId(pollId),
        status: 'active',
        options: [
          { text: 'Yes', votes: 2 },
          { text: 'No', votes: 1 },
        ],
        expiresAt: null,
      }),
    }));
    pollVoteFindOneMock.mockReturnValue({
      session: vi.fn().mockResolvedValue({
        optionIndex: 0,
      }),
    });

    const { POST } = await import('@/app/api/poll/vote/route');
    const response = await POST(
      new Request('http://localhost/api/poll/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.10',
        },
        body: JSON.stringify({
          pollId,
          optionIndex: 0,
        }),
      }) as unknown as NextRequest
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({
      success: false,
      error: 'You have already voted in this poll.',
    });
    expect(pollVoteCreateMock).not.toHaveBeenCalled();
    expect(pollUpdateOneMock).not.toHaveBeenCalled();
  });

  it('increments the chosen option and total vote count after a successful vote', async () => {
    const txSession = createTxSession();
    const pollId = new Types.ObjectId().toString();
    const objectId = new Types.ObjectId(pollId);

    startSessionMock.mockResolvedValue(txSession);
    pollFindByIdMock
      .mockImplementationOnce(() => ({
        session: vi.fn().mockResolvedValue({
          _id: objectId,
          status: 'active',
          options: [
            { text: 'Yes', votes: 3 },
            { text: 'No', votes: 2 },
          ],
          expiresAt: null,
        }),
      }))
      .mockImplementationOnce(() => ({
        session: vi.fn().mockResolvedValue({
          _id: objectId,
          question: 'Should Lokswami run this poll?',
          options: [
            { text: 'Yes', votes: 4 },
            { text: 'No', votes: 2 },
          ],
          totalVotes: 6,
          status: 'active',
          expiresAt: null,
          createdAt: new Date('2026-04-15T08:00:00.000Z'),
          updatedAt: new Date('2026-04-15T08:01:00.000Z'),
        }),
      }));

    pollVoteFindOneMock.mockReturnValue({
      session: vi.fn().mockResolvedValue(null),
    });
    pollVoteCreateMock.mockResolvedValue([{ _id: new Types.ObjectId() }]);
    pollUpdateOneMock.mockResolvedValue({ acknowledged: true });

    const { POST } = await import('@/app/api/poll/vote/route');
    const response = await POST(
      new Request('http://localhost/api/poll/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.10',
        },
        body: JSON.stringify({
          pollId,
          optionIndex: 0,
        }),
      }) as unknown as NextRequest
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(pollVoteCreateMock).toHaveBeenCalledTimes(1);
    expect(pollUpdateOneMock).toHaveBeenCalledWith(
      { _id: objectId },
      {
        $inc: {
          'options.0.votes': 1,
          totalVotes: 1,
        },
      },
      { session: txSession }
    );
    expect(payload.success).toBe(true);
    expect(payload.data.totalVotes).toBe(6);
    expect(payload.data.options[0]).toEqual(
      expect.objectContaining({
        text: 'Yes',
        votes: 4,
        percentage: 67,
      })
    );
  });
});

