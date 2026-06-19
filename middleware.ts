import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { LOKSWAMI_SESSION_COOKIE } from '@/lib/auth/cookies';
import { getJwtSecretOrNull } from '@/lib/auth/jwtSecret';
import { resolveRouteGuardDecision } from '@/lib/auth/routeGuards';
import {
  getAdminLimiter,
  getApiLimiter,
  getHeavyRouteLimiter,
} from '@/lib/security/getRateLimiter';
import { getIpRateLimitKey, getUserRateLimitKey } from '@/lib/security/ipUtils';
import {
  getRouteScopedApiLimiterPrefix,
  isCacheablePublicReadApiRoute,
} from '@/lib/security/publicApiRateLimitPolicy';
import { logApiRequestFromMiddleware } from '@/lib/security/requestLogger';

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

const HEAVY_RATE_LIMIT_ROUTES = [
  { pattern: /^\/api\/v1\/public\/search(?:\/|$)/, scope: 'public-search' },
  { pattern: /^\/api\/ai\/actions(?:\/|$)/, scope: 'ai-actions' },
  { pattern: /^\/api\/ai\/search(?:\/|$)/, scope: 'ai-search' },
  { pattern: /^\/api\/ai\/suggestions(?:\/|$)/, scope: 'ai-suggestions' },
  { pattern: /^\/api\/ai\/summary(?:\/|$)/, scope: 'ai-summary' },
  { pattern: /^\/api\/admin\/epapers\/assist(?:\/|$)/, scope: 'epaper-assist' },
  {
    pattern: /^\/api\/admin\/epapers\/[^/]+\/crop-hotspot(?:\/|$)/,
    scope: 'epaper-crop-hotspot',
  },
  {
    pattern: /^\/api\/admin\/epapers\/[^/]+\/generate-page-images(?:\/|$)/,
    scope: 'epaper-generate-page-images',
  },
  { pattern: /^\/api\/admin\/epapers\/[^/]+\/ocr(?:\/|$)/, scope: 'epaper-ocr' },
  { pattern: /^\/api\/admin\/epapers\/[^/]+\/tts(?:\/|$)/, scope: 'epaper-tts' },
  {
    pattern: /^\/api\/admin\/epapers\/[^/]+\/articles\/[^/]+\/tts(?:\/|$)/,
    scope: 'epaper-article-tts',
  },
  {
    pattern: /^\/api\/admin\/articles\/[^/]+\/breaking-tts(?:\/|$)/,
    scope: 'article-breaking-tts',
  },
  {
    pattern: /^\/api\/admin\/analytics\/briefing-schedules\/[^/]+\/run(?:\/|$)/,
    scope: 'analytics-briefing-run',
  },
  {
    pattern: /^\/api\/admin\/social-posts\/generate(?:\/|$)/,
    scope: 'social-post-generate',
  },
];

type SessionToken = Awaited<ReturnType<typeof getSessionToken>>;

function getHeavyRateLimitPrefix(pathname: string) {
  const route = HEAVY_RATE_LIMIT_ROUTES.find(({ pattern }) => pattern.test(pathname));
  return route ? `heavy:${route.scope}` : null;
}

function createRateLimitResponse(error: string, message: string, retryAfter: number) {
  return new NextResponse(
    JSON.stringify({
      error,
      message,
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
        'Retry-After': String(retryAfter),
      },
    }
  );
}

function getSessionAwareRateLimitKey(
  request: NextRequest,
  session: SessionToken,
  prefix: string
) {
  const email = typeof session?.email === 'string' ? session.email.trim() : '';
  const userId = typeof session?.userId === 'string' ? session.userId.trim() : '';
  const accountKey = userId || email;
  return accountKey ? getUserRateLimitKey(accountKey, prefix) : getIpRateLimitKey(request, prefix);
}

/** Protects admin and signed-in reader routes with the active NextAuth session. */
export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  const isApiRequest = pathname.startsWith('/api/');
  const contentType = request.headers.get('content-type') || '';
  
  // CRITICAL: Skip middleware processing for large file upload routes IMMEDIATELY.
  // Any property access or function call on 'request' before this point (like getSessionToken)
  // may disturb the request body stream, causing failures in Next.js 15.
  const isLargeUploadRoute =
    pathname === '/api/admin/epapers/upload' ||
    pathname === '/api/admin/upload' ||
    (pathname.includes('/api/admin/epapers/') && pathname.includes('/pages')) ||
    (isApiRequest && contentType.includes('multipart/form-data'));

  if (isLargeUploadRoute) {
    return NextResponse.next();
  }

  const startedAt = Date.now();

  try {
    const isApiRequest = pathname.startsWith('/api/');
    
    let session: Awaited<ReturnType<typeof getSessionToken>> = null;

    function scheduleRequestLog(response: NextResponse) {
      if (isApiRequest) {
        event.waitUntil(
          logApiRequestFromMiddleware({
            request,
            responseStatus: response.status,
            startedAt,
            session,
          })
        );
      }

      return response;
    }

    const isAdminArea = pathname.startsWith('/admin') || pathname.startsWith('/api/admin/');
    const isAuthApiRoute = pathname.startsWith('/api/auth/');
    const heavyRateLimitPrefix = getHeavyRateLimitPrefix(pathname);
    const isHeavyRoute = Boolean(heavyRateLimitPrefix);
    const isPublicReadRoute = isCacheablePublicReadApiRoute(request.method, pathname);

    if (isApiRequest && !isAdminArea && !isAuthApiRoute) {
      if (heavyRateLimitPrefix) {
        const heavyLimiter = getHeavyRouteLimiter();
        const heavyKey = getIpRateLimitKey(request, heavyRateLimitPrefix);
        const heavyResult = heavyLimiter.check(heavyKey);

        if (!heavyResult.allowed) {
          const retryAfter = heavyResult.retryAfter || 600;
          return scheduleRequestLog(createRateLimitResponse(
            'Too many expensive requests',
            `Please try again in ${retryAfter} seconds`,
            retryAfter
          ));
        }
      }

      // Reader pages fan out across several cacheable GET APIs at once. Keep
      // the app limiter focused on writes and non-cacheable public APIs; use
      // CDN/WAF rules for bulk public read traffic.
      if (!isPublicReadRoute && !isHeavyRoute) {
        const apiLimiter = getApiLimiter();
        const apiKey = getIpRateLimitKey(
          request,
          getRouteScopedApiLimiterPrefix(pathname)
        );
        const apiResult = apiLimiter.check(apiKey);

        if (!apiResult.allowed) {
          const retryAfter = apiResult.retryAfter || 300;
          return scheduleRequestLog(createRateLimitResponse(
            'Too many API requests',
            `Please try again in ${retryAfter} seconds`,
            retryAfter
          ));
        }
      }
    }

    session = await getSessionToken(request);
    const email = typeof session?.email === 'string' ? session.email.trim() : '';
    const userId = typeof session?.userId === 'string' ? session.userId.trim() : '';

    if (heavyRateLimitPrefix && isAdminArea) {
      const heavyLimiter = getHeavyRouteLimiter();
      const heavyKey = getSessionAwareRateLimitKey(request, session, heavyRateLimitPrefix);
      const heavyResult = heavyLimiter.check(heavyKey);

      if (!heavyResult.allowed) {
        const retryAfter = heavyResult.retryAfter || 600;
        return scheduleRequestLog(createRateLimitResponse(
          'Too many expensive requests',
          `Please try again in ${retryAfter} seconds`,
          retryAfter
        ));
      }
    }

    if (isAdminArea) {
      const adminLimiter = getAdminLimiter();
      const adminKey = getSessionAwareRateLimitKey(request, session, 'admin');
      const adminResult = adminLimiter.check(adminKey);

      if (!adminResult.allowed) {
        const retryAfter = adminResult.retryAfter || 600;
        return scheduleRequestLog(createRateLimitResponse(
          'Too many admin requests',
          `Please try again in ${retryAfter} seconds`,
          retryAfter
        ));
      }
    }

    const decision = resolveRouteGuardDecision({
      pathname,
      searchParams: request.nextUrl.searchParams,
      isAuthenticated: Boolean(email || userId),
      role: session?.role,
      isActive: session?.isActive !== false,
    });

    if (decision.action === 'redirect') {
      return scheduleRequestLog(NextResponse.redirect(
        new URL(decision.location, request.url),
        decision.status ?? 302
      ));
    }

    return scheduleRequestLog(NextResponse.next());
  } catch (error) {
    console.error('Middleware auth check failed:', error);
    return NextResponse.next();
  }
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/:path*',
    '/login',
    '/signin',
    '/main/account/:path*',
    '/main/saved/:path*',
    '/main/preferences/:path*',
  ],
};
