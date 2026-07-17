import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import User from '@/lib/models/User';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { canManageWorkflowAssignments } from '@/lib/auth/permissions';
import { ADMIN_ROLE_QUERY_VALUES, normalizeAdminRole, type AdminRole } from '@/lib/auth/roles';
import { getAllWorkflowDeskItems, type DeskItem } from '@/lib/admin/articleWorkflowOverview';

type Candidate = { _id?: unknown; name?: string; email?: string; role?: string; isActive?: boolean };

const TERMINAL = new Set(['published', 'archived']);

function roleScore(role: AdminRole, contentTypes: Set<DeskItem['contentType']>) {
  if (role === 'copy_editor') return contentTypes.has('epaper') ? 1 : 0;
  if (role === 'admin') return 1;
  if (role === 'super_admin') return 2;
  return contentTypes.size === 1 && contentTypes.has('story') ? 2 : 3;
}

export async function GET(request: NextRequest) {
  const admin = await getAdminSessionFromReq(request);
  if (!admin || !canManageWorkflowAssignments(admin.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const requested = new Set(
      String(request.nextUrl.searchParams.get('contentTypes') || 'article')
        .split(',')
        .map((value) => value.trim())
        .filter((value): value is DeskItem['contentType'] => ['article', 'story', 'video', 'epaper'].includes(value))
    );
    await connectDB();
    const [members, items] = await Promise.all([
      User.find({ role: { $in: ADMIN_ROLE_QUERY_VALUES }, isActive: { $ne: false } })
        .select('_id name email role isActive')
        .lean() as Promise<Candidate[]>,
      getAllWorkflowDeskItems(),
    ]);

    const workload = new Map<string, number>();
    for (const item of items) {
      if (TERMINAL.has(item.status)) continue;
      const keys = [item.assignedToId, item.assignedToEmail.toLowerCase()].filter(Boolean);
      for (const key of keys) workload.set(key, (workload.get(key) || 0) + 1);
    }

    const suggestions = members.flatMap((member) => {
      const role = normalizeAdminRole(member.role);
      const id = typeof member._id?.toString === 'function' ? member._id.toString() : '';
      const email = String(member.email || '').trim().toLowerCase();
      if (!role || !id || !email) return [];
      const activeWorkload = Math.max(workload.get(id) || 0, workload.get(email) || 0);
      return [{
        id,
        name: String(member.name || email).trim(),
        email,
        role,
        isActive: true,
        activeWorkload,
        suitability: roleScore(role, requested),
        reason: `${role.replace(/_/g, ' ')} \u00b7 ${activeWorkload} active item${activeWorkload === 1 ? '' : 's'}`,
      }];
    }).sort((left, right) => left.suitability - right.suitability || left.activeWorkload - right.activeWorkload || left.name.localeCompare(right.name));

    return NextResponse.json({ success: true, data: suggestions });
  } catch (error) {
    console.error('Assignee suggestions GET failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to load assignee suggestions' }, { status: 500 });
  }
}
