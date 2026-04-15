import 'server-only';

import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import type { AdminPollPayload, PollDTO } from '@/lib/types/poll';

export const MIN_POLL_OPTIONS = 2;
export const MAX_POLL_OPTIONS = 4;
export const MAX_POLL_QUESTION_LENGTH = 240;
export const MAX_POLL_OPTION_LENGTH = 120;

type PollLike = {
  _id?: unknown;
  question?: string;
  options?: Array<{ text?: string; votes?: number }>;
  totalVotes?: number;
  status?: string;
  expiresAt?: Date | string | null;
  linkedArticleId?: unknown;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

function clean(value: unknown, max: number) {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}

function normalizeDate(value: unknown) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function toIsoString(value: unknown) {
  const parsed = normalizeDate(value);
  return parsed ? parsed.toISOString() : null;
}

export function isPollExpired(value: unknown, now = new Date()) {
  const expiresAt = normalizeDate(value);
  if (!expiresAt) {
    return false;
  }

  return expiresAt.getTime() <= now.getTime();
}

export function toPollDTO(source: PollLike, now = new Date()): PollDTO {
  const totalVotes =
    typeof source.totalVotes === 'number' && Number.isFinite(source.totalVotes) && source.totalVotes > 0
      ? Math.floor(source.totalVotes)
      : 0;

  const options = Array.isArray(source.options) ? source.options : [];
  const safeOptions = options.map((option) => {
    const votes =
      typeof option?.votes === 'number' && Number.isFinite(option.votes) && option.votes > 0
        ? Math.floor(option.votes)
        : 0;

    return {
      text: clean(option?.text, MAX_POLL_OPTION_LENGTH),
      votes,
      percentage: totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0,
    };
  });

  return {
    id: typeof source._id?.toString === 'function' ? source._id.toString() : '',
    question: clean(source.question, MAX_POLL_QUESTION_LENGTH),
    options: safeOptions,
    totalVotes,
    status: source.status === 'active' ? 'active' : 'inactive',
    expiresAt: toIsoString(source.expiresAt),
    linkedArticleId:
      typeof source.linkedArticleId?.toString === 'function'
        ? source.linkedArticleId.toString()
        : null,
    createdAt: toIsoString(source.createdAt) || '',
    updatedAt: toIsoString(source.updatedAt) || '',
    isExpired: isPollExpired(source.expiresAt, now),
  };
}

function normalizeOptionTexts(input: unknown) {
  if (!Array.isArray(input)) {
    return [] as string[];
  }

  return input.map((value) => clean(value, MAX_POLL_OPTION_LENGTH)).filter(Boolean);
}

function normalizeStatus(value: unknown) {
  return value === 'active' ? 'active' : 'inactive';
}

function normalizeLinkedArticleId(value: unknown) {
  const normalized = clean(value, 64);
  if (!normalized) {
    return null;
  }

  return Types.ObjectId.isValid(normalized) ? normalized : 'invalid';
}

function normalizeExpiry(value: unknown) {
  if (value == null || value === '') {
    return { iso: null, date: null as Date | null, error: '' };
  }

  const parsed = normalizeDate(value);
  if (!parsed) {
    return { iso: null, date: null as Date | null, error: 'Expiry date is invalid.' };
  }

  return {
    iso: parsed.toISOString(),
    date: parsed,
    error: '',
  };
}

export function parseAdminPollPayload(body: unknown): {
  data: AdminPollPayload | null;
  error: string;
} {
  const source = typeof body === 'object' && body ? (body as Record<string, unknown>) : {};
  const question = clean(source.question, MAX_POLL_QUESTION_LENGTH);
  const options = normalizeOptionTexts(source.options);
  const status = normalizeStatus(source.status);
  const expiry = normalizeExpiry(source.expiresAt);
  const linkedArticleId = normalizeLinkedArticleId(source.linkedArticleId);

  if (!question) {
    return {
      data: null,
      error: 'Question is required.',
    };
  }

  if (options.length < MIN_POLL_OPTIONS || options.length > MAX_POLL_OPTIONS) {
    return {
      data: null,
      error: `Poll must have between ${MIN_POLL_OPTIONS} and ${MAX_POLL_OPTIONS} options.`,
    };
  }

  const normalizedOptionKeys = new Set(options.map((option) => option.toLowerCase()));
  if (normalizedOptionKeys.size !== options.length) {
    return {
      data: null,
      error: 'Poll options must be unique.',
    };
  }

  if (expiry.error) {
    return {
      data: null,
      error: expiry.error,
    };
  }

  if (status === 'active' && expiry.date && expiry.date.getTime() <= Date.now()) {
    return {
      data: null,
      error: 'Active polls cannot already be expired.',
    };
  }

  if (linkedArticleId === 'invalid') {
    return {
      data: null,
      error: 'Linked article is invalid.',
    };
  }

  return {
    data: {
      question,
      options,
      status,
      expiresAt: expiry.iso,
      linkedArticleId,
    },
    error: '',
  };
}

export function getClientIp(req: Pick<NextRequest, 'headers'>) {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim().slice(0, 120) || '';
  }

  return clean(req.headers.get('x-real-ip'), 120);
}

function hashFingerprint(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function buildVoterIdentity(input: {
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  acceptLanguage?: string | null;
}) {
  const userId = clean(input.userId, 120);
  const ipAddress = clean(input.ipAddress, 120);
  const userAgent = clean(input.userAgent, 240);
  const acceptLanguage = clean(input.acceptLanguage, 80);

  const rawFingerprint = userId
    ? `user:${userId.toLowerCase()}`
    : ipAddress
      ? `ip:${ipAddress}`
      : `fallback:${userAgent.toLowerCase()}|${acceptLanguage.toLowerCase()}`;

  return {
    userId,
    ipAddress,
    voterFingerprint: hashFingerprint(rawFingerprint),
  };
}

export function toObjectIdOrNull(value: string | null | undefined) {
  if (!value || !Types.ObjectId.isValid(value)) {
    return null;
  }

  return new Types.ObjectId(value);
}

