import { auth } from '@/lib/auth';
import {
  isAdminRole,
  isSuperAdminRole,
  type AdminRole,
} from '@/lib/auth/roles';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { getJwtSecretOrNull } from '@/lib/auth/jwtSecret';
import { LOKSWAMI_SESSION_COOKIE } from '@/lib/auth/cookies';

export type AdminSessionIdentity = {
  id: string;
  email: string;
  name: string;
  username: string;
  role: AdminRole;
};

export async function getAdminSession(): Promise<AdminSessionIdentity | null> {
  const session = await auth();
  const sessionUser = session?.user;
  const email = sessionUser?.email?.trim() || '';
  const role = sessionUser?.role;

  if (!sessionUser || !email || !isAdminRole(role) || sessionUser.isActive === false) {
    return null;
  }

  return {
    id: sessionUser.userId || sessionUser.id || email,
    email,
    name: sessionUser.name?.trim() || email.split('@')[0] || 'Admin',
    username: email,
    role,
  };
}

export async function getSuperAdminSession(): Promise<AdminSessionIdentity | null> {
  const session = await getAdminSession();

  if (!session || !isSuperAdminRole(session.role)) {
    return null;
  }

  return session;
}

export async function getAdminSessionFromReq(req: NextRequest): Promise<AdminSessionIdentity | null> {
  const secret = getJwtSecretOrNull();
  if (!secret) return null;

  const token = await getToken({ req, secret, cookieName: LOKSWAMI_SESSION_COOKIE });
  const email = token?.email?.trim() || '';
  const role = token?.role;

  if (!token || !email || !isAdminRole(role) || token.isActive === false) {
    return null;
  }

  return {
    id: String(token.userId || token.id || token.sub || email),
    email,
    name: String(token.name || email.split('@')[0] || 'Admin'),
    username: email,
    role: role as AdminRole,
  };
}

export async function getSuperAdminSessionFromReq(req: NextRequest): Promise<AdminSessionIdentity | null> {
  const session = await getAdminSessionFromReq(req);

  if (!session || !isSuperAdminRole(session.role)) {
    return null;
  }

  return session;
}
