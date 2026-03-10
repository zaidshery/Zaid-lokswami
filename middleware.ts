import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { LOKSWAMI_SESSION_COOKIE } from '@/lib/auth/cookies';
import { getJwtSecretOrNull } from '@/lib/auth/jwtSecret';
import { resolveRouteGuardDecision } from '@/lib/auth/routeGuards';

async function getSessionToken(request: NextRequest) {
  const secret = getJwtSecretOrNull();
  if (!secret) {
    return null;
  }

  return getToken({
    req: request,
    secret,
    cookieName: LOKSWAMI_SESSION_COOKIE,
  });
}

/** Protects admin and signed-in reader routes with the active NextAuth session. */
export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;
    const session = await getSessionToken(request);
    const email = typeof session?.email === 'string' ? session.email.trim() : '';
    const userId = typeof session?.userId === 'string' ? session.userId.trim() : '';
    const decision = resolveRouteGuardDecision({
      pathname,
      searchParams: request.nextUrl.searchParams,
      isAuthenticated: Boolean(email || userId),
      role: session?.role,
      isActive: session?.isActive !== false,
    });

    if (decision.action === 'redirect') {
      return NextResponse.redirect(
        new URL(decision.location, request.url),
        decision.status ?? 302
      );
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Middleware auth check failed:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/login',
    '/signin',
    '/main/account/:path*',
    '/main/saved/:path*',
    '/main/preferences/:path*',
  ],
};
