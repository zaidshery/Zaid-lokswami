import { NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { canManageWorkflowAssignments } from '@/lib/auth/permissions';
import { ADMIN_ROLE_QUERY_VALUES, normalizeAdminRole } from '@/lib/auth/roles';
import User from '@/lib/models/User';

type TeamOptionRecord = {
  _id?: unknown;
  name?: string;
  email?: string;
  role?: string;
  isActive?: boolean;
};

function toOption(record: TeamOptionRecord) {
  const normalizedRole = normalizeAdminRole(record.role);
  if (!normalizedRole) {
    return null;
  }

  return {
    id: typeof record._id?.toString === 'function' ? record._id.toString() : '',
    name:
      typeof record.name === 'string' && record.name.trim()
        ? record.name.trim()
        : typeof record.email === 'string'
          ? record.email.trim()
          : '',
    email: typeof record.email === 'string' ? record.email.trim() : '',
    role: normalizedRole,
    isActive: record.isActive !== false,
  };
}

export async function GET() {
  try {
    const admin = await getAdminSessionFromReq(req);
    if (!admin || !canManageWorkflowAssignments(admin.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();
    const members = (await User.find({
      role: { $in: ADMIN_ROLE_QUERY_VALUES },
      isActive: { $ne: false },
    })
      .select('_id name email role isActive')
      .sort({ role: 1, name: 1, email: 1 })
      .lean()) as unknown as TeamOptionRecord[];

    return NextResponse.json({
      success: true,
      data: members
        .map(toOption)
        .filter((member): member is NonNullable<ReturnType<typeof toOption>> => {
          if (!member) {
            return false;
          }

          return Boolean(member.id && member.email);
        }),
    });
  } catch (error) {
    console.error('Team options GET failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load assignable team members' },
      { status: 500 }
    );
  }
}
