import { NextRequest } from 'next/server';
import { apiError, apiSuccess, withAdminApi } from '@/lib/api/adminRoute';
import connectDB from '@/lib/db/mongoose';
import { canManageTargetAdminRole, canManageTeam } from '@/lib/auth/permissions';
import { getStaffCredentialStatus } from '@/lib/auth/staffCredentials';
import { isAdminRole, normalizeAdminRole } from '@/lib/auth/roles';
import User from '@/lib/models/User';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type TeamMemberRecord = {
  _id?: unknown;
  name?: string;
  email?: string;
  image?: string;
  role?: string;
  loginId?: string;
  passwordHash?: string;
  passwordSetAt?: Date | string | null;
  setupTokenExpiresAt?: Date | string | null;
  isActive?: boolean;
  lastLoginAt?: Date | string | null;
  createdAt?: Date | string;
};

function toTeamMember(record: TeamMemberRecord) {
  const normalizedRole = normalizeAdminRole(record.role);
  if (!normalizedRole) {
    return null;
  }

  return {
    id: typeof record._id?.toString === 'function' ? record._id.toString() : '',
    name: typeof record.name === 'string' ? record.name.trim() : '',
    email: typeof record.email === 'string' ? record.email.trim() : '',
    image: typeof record.image === 'string' ? record.image.trim() : '',
    role: normalizedRole,
    loginId: typeof record.loginId === 'string' ? record.loginId.trim() : '',
    isActive: record.isActive !== false,
    credentialStatus: getStaffCredentialStatus({
      passwordHash: typeof record.passwordHash === 'string' ? record.passwordHash : '',
      setupTokenExpiresAt: record.setupTokenExpiresAt || null,
    }),
    passwordSetAt: record.passwordSetAt ? new Date(record.passwordSetAt).toISOString() : null,
    setupExpiresAt: record.setupTokenExpiresAt
      ? new Date(record.setupTokenExpiresAt).toISOString()
      : null,
    lastLoginAt: record.lastLoginAt ? new Date(record.lastLoginAt).toISOString() : null,
    createdAt: record.createdAt ? new Date(record.createdAt).toISOString() : null,
  };
}

async function ensureSuperAdminRemovalIsSafe(id: string) {
  const remainingSuperAdmins = await User.countDocuments({
    role: 'super_admin',
    _id: { $ne: id },
  });

  return remainingSuperAdmins > 0;
}

export const PATCH = withAdminApi<RouteContext>(
  async (req: NextRequest, context: RouteContext, { admin }) => {
    const { id } = await context.params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.role === 'string') {
      if (!isAdminRole(body.role)) {
        return apiError('Valid admin role is required', 400, 'VALIDATION_ERROR');
      }

      updates.role = body.role;
    }

    if (typeof body.isActive === 'boolean') {
      updates.isActive = body.isActive;
    }

    if (typeof body.name === 'string' && body.name.trim()) {
      updates.name = body.name.trim();
    }

    if (Object.keys(updates).length === 0) {
      return apiError('No valid updates provided', 400, 'VALIDATION_ERROR');
    }

    await connectDB();
    const existingUser = await User.findById(id).select('_id role').lean<{
      _id?: unknown;
      role?: unknown;
    } | null>();

    if (!existingUser) {
      return apiError('Member not found', 404, 'NOT_FOUND');
    }

    const currentRole = normalizeAdminRole(existingUser.role);
    if (!currentRole) {
      return apiError('Only admin-side members can be managed here', 400, 'BAD_REQUEST');
    }

    if (!canManageTargetAdminRole(admin.role, currentRole)) {
      return apiError('Forbidden', 403, 'FORBIDDEN');
    }

    const nextRole = typeof updates.role === 'string' ? normalizeAdminRole(updates.role) : currentRole;
    if (!nextRole || !canManageTargetAdminRole(admin.role, nextRole)) {
      return apiError('You cannot assign that role', 403, 'FORBIDDEN');
    }

    const deactivatingLastSuperAdmin =
      currentRole === 'super_admin' &&
      ((updates.role && nextRole !== 'super_admin') || updates.isActive === false);

    if (deactivatingLastSuperAdmin && !(await ensureSuperAdminRemovalIsSafe(id))) {
      return apiError('At least one active super admin must remain', 400, 'BAD_REQUEST');
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    ).lean<TeamMemberRecord | null>();

    if (!updatedUser) {
      return apiError('Member not found', 404, 'NOT_FOUND');
    }

    const teamMember = toTeamMember(updatedUser);
    if (!teamMember) {
      return apiError('Managed user no longer has an admin role', 400, 'BAD_REQUEST');
    }

    return apiSuccess(teamMember);
  },
  {
    authorize: (role) => canManageTeam(role),
    mutation: true,
  }
);

export const DELETE = withAdminApi<RouteContext>(
  async (_req: NextRequest, context: RouteContext, { admin }) => {
    const { id } = await context.params;
    await connectDB();

    const existingUser = await User.findById(id).select('_id role').lean<{
      _id?: unknown;
      role?: unknown;
    } | null>();

    if (!existingUser) {
      return apiError('Member not found', 404, 'NOT_FOUND');
    }

    const currentRole = normalizeAdminRole(existingUser.role);
    if (!currentRole) {
      return apiError('Only admin-side members can be removed here', 400, 'BAD_REQUEST');
    }

    if (!canManageTargetAdminRole(admin.role, currentRole)) {
      return apiError('Forbidden', 403, 'FORBIDDEN');
    }

    if (currentRole === 'super_admin' && !(await ensureSuperAdminRemovalIsSafe(id))) {
      return apiError('At least one super admin must remain', 400, 'BAD_REQUEST');
    }

    await User.findByIdAndUpdate(
      id,
      {
        $set: {
          role: 'reader',
          isActive: true,
        },
      },
      { new: true }
    ).lean<TeamMemberRecord | null>();

    return apiSuccess(null);
  },
  {
    authorize: (role) => canManageTeam(role),
    mutation: true,
  }
);
