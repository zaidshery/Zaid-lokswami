import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import ContactMessage from '@/lib/models/ContactMessage';
import { getAdminSession } from '@/lib/auth/admin';
import { canManageContactInbox } from '@/lib/auth/permissions';
import {
  getStoredContactMessageById,
  updateStoredContactMessageWorkflow,
  type ContactWorkflowStatus,
} from '@/lib/storage/contactMessagesFile';

const VALID_STATUS = new Set<ContactWorkflowStatus>(['new', 'in_progress', 'resolved']);

function clean(value: unknown, max: number) {
  return String(value ?? '')
    .trim()
    .slice(0, max);
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
        .filter((note) => Boolean(note))
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

function resolveId(req: NextRequest) {
  const segment = req.nextUrl.pathname.split('/').pop();
  return clean(segment, 80);
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

    const id = resolveId(req);
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Invalid contact message id' },
        { status: 400 }
      );
    }

    if (process.env.MONGODB_URI) {
      try {
        await connectDB();
        const row = await ContactMessage.findById(id).lean();
        if (!row) {
          return NextResponse.json(
            { success: false, error: 'Contact message not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          data: normalizeMongoMessage(row as Record<string, unknown>),
        });
      } catch (mongoError) {
        console.error('Mongo unavailable for contact detail, using file store:', mongoError);
      }
    }

    const fileItem = await getStoredContactMessageById(id);
    if (!fileItem) {
      return NextResponse.json(
        { success: false, error: 'Contact message not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: fileItem,
    });
  } catch (error) {
    console.error('Failed to fetch contact message:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch contact message' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
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

    const id = resolveId(req);
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Invalid contact message id' },
        { status: 400 }
      );
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

    const statusInput = clean(body.status, 20);
    const assignee = clean(body.assignee, 120);
    const note = clean(body.note, 1000);

    if (statusInput && !VALID_STATUS.has(statusInput as ContactWorkflowStatus)) {
      return NextResponse.json(
        { success: false, error: 'Invalid workflow status' },
        { status: 400 }
      );
    }

    const noteAuthor =
      clean((user.username || user.email) as string, 120) || 'Admin';

    if (process.env.MONGODB_URI) {
      try {
        await connectDB();
        const row = await ContactMessage.findById(id);
        if (!row) {
          return NextResponse.json(
            { success: false, error: 'Contact message not found' },
            { status: 404 }
          );
        }

        if (statusInput) {
          row.status = statusInput as ContactWorkflowStatus;
        }

        if (!row.ticketId) {
          row.ticketId = `LEGACY-${row._id.toString().slice(-8).toUpperCase()}`;
        }

        if (typeof body.assignee === 'string') {
          row.assignee = assignee;
        }

        if (note) {
          row.notes = [
            {
              body: note,
              author: noteAuthor,
              createdAt: new Date(),
            },
            ...(Array.isArray(row.notes) ? row.notes : []),
          ];
        }

        await row.save();

        return NextResponse.json({
          success: true,
          data: normalizeMongoMessage(row.toObject() as Record<string, unknown>),
        });
      } catch (mongoError) {
        console.error('Mongo unavailable for contact workflow update, using file store:', mongoError);
      }
    }

    const updated = await updateStoredContactMessageWorkflow(id, {
      status: statusInput ? (statusInput as ContactWorkflowStatus) : undefined,
      assignee: typeof body.assignee === 'string' ? assignee : undefined,
      note,
      noteAuthor,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Contact message not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Failed to update contact workflow:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update contact workflow' },
      { status: 500 }
    );
  }
}
