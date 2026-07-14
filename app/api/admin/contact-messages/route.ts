import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import ContactMessage from '@/lib/models/ContactMessage';
import { getAdminSession } from '@/lib/auth/admin';
import { canManageContactInbox } from '@/lib/auth/permissions';
import {
  listStoredContactMessages,
  type ContactWorkflowStatus,
} from '@/lib/storage/contactMessagesFile';

type CountSummary = {
  all: number;
  new: number;
  in_progress: number;
  resolved: number;
};

const VALID_STATUS = new Set<ContactWorkflowStatus>([
  'new',
  'in_progress',
  'resolved',
]);

function clean(value: unknown, max: number) {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}

function parsePagination(req: NextRequest) {
  const url = req.nextUrl;
  const page = Number.parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Number.parseInt(url.searchParams.get('limit') || '20', 10);
  const statusRaw = clean(url.searchParams.get('status'), 24);
  const query = clean(url.searchParams.get('q'), 200);

  const status: ContactWorkflowStatus | 'all' = VALID_STATUS.has(
    statusRaw as ContactWorkflowStatus
  )
    ? (statusRaw as ContactWorkflowStatus)
    : 'all';

  return {
    page: Number.isFinite(page) ? Math.max(1, page) : 1,
    limit: Number.isFinite(limit) ? Math.min(100, Math.max(1, limit)) : 20,
    status,
    query,
  };
}

function normalizeMongoMessage(input: Record<string, unknown>) {
  const id = clean(input._id, 80);
  const ticketId = clean(input.ticketId, 40) || `LEGACY-${id.slice(-8).toUpperCase()}`;
  const notes = Array.isArray(input.notes)
    ? input.notes
        .map((note) => {
          if (!note || typeof note !== 'object') return null;
          const source = note as Record<string, unknown>;
          const body = clean(source.body, 1000);
          if (!body) return null;

          return {
            id: clean(source.id, 80) || clean(source._id, 80) || `${Date.now()}`,
            body,
            author: clean(source.author, 120) || 'Admin',
            createdAt: String(source.createdAt || new Date().toISOString()),
          };
        })
        .filter((note) => Boolean(note)
      )
    : [];

  return {
    _id: id,
    ticketId,
    name: clean(input.name, 120),
    email: clean(input.email, 180),
    phone: clean(input.phone, 30),
    subject: clean(input.subject, 200),
    message: clean(input.message, 5000),
    source: clean(input.source, 40),
    ipAddress: clean(input.ipAddress, 120),
    userAgent: clean(input.userAgent, 500),
    status: VALID_STATUS.has(input.status as ContactWorkflowStatus)
      ? (input.status as ContactWorkflowStatus)
      : 'new',
    assignee: clean(input.assignee, 120),
    notes,
    createdAt: String(input.createdAt || new Date().toISOString()),
    updatedAt: String(input.updatedAt || new Date().toISOString()),
  };
}

async function fetchMongoCounts(filter: Record<string, unknown>) {
  const [all, next, inProgress, resolved] = await Promise.all([
    ContactMessage.countDocuments(filter),
    ContactMessage.countDocuments({ ...filter, status: 'new' }),
    ContactMessage.countDocuments({ ...filter, status: 'in_progress' }),
    ContactMessage.countDocuments({ ...filter, status: 'resolved' }),
  ]);

  return {
    all,
    new: next,
    in_progress: inProgress,
    resolved,
  } as CountSummary;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAdminSession();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (!canManageContactInbox(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { page, limit, status, query } = parsePagination(req);

    if (process.env.MONGODB_URI) {
      try {
        await connectDB();

        const mongoFilter: Record<string, unknown> = {};
        if (status !== 'all') {
          mongoFilter.status = status;
        }

        if (query) {
          const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          mongoFilter.$or = [
            { ticketId: regex },
            { name: regex },
            { email: regex },
            { subject: regex },
            { message: regex },
            { assignee: regex },
          ];
        }

        const [rows, total, counts] = await Promise.all([
          ContactMessage.find(mongoFilter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
          ContactMessage.countDocuments(mongoFilter),
          fetchMongoCounts(query
            ? {
                $or: [
                  { ticketId: new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
                  { name: new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
                  { email: new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
                  { subject: new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
                  { message: new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
                  { assignee: new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
                ],
              }
            : {})
        ]);

        const totalPages = Math.max(1, Math.ceil(total / limit));

        return NextResponse.json({
          success: true,
          data: rows.map((row) => normalizeMongoMessage(row as Record<string, unknown>)),
          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
          counts,
        });
      } catch (mongoError) {
        console.error('Mongo unavailable for contact inbox, using file store:', mongoError);
      }
    }

    const fileResult = await listStoredContactMessages({
      page,
      limit,
      status,
      query,
    });

    return NextResponse.json({
      success: true,
      data: fileResult.data,
      pagination: {
        page: fileResult.page,
        limit: fileResult.limit,
        total: fileResult.total,
        totalPages: fileResult.totalPages,
      },
      counts: fileResult.counts,
    });
  } catch (error) {
    console.error('Failed to list contact messages:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load contact inbox' },
      { status: 500 }
    );
  }
}

