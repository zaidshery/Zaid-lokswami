const CACHEABLE_PUBLIC_READ_ROUTES = [
  /^\/api\/health\/?$/,
  /^\/api\/breaking(?:\/|$)/,
  /^\/api\/poll\/current\/?$/,
  /^\/api\/v1\/public(?:\/|$)/,
  /^\/api\/articles\/latest\/?$/,
  /^\/api\/epapers(?:\/|$)/,
  /^\/api\/videos\/latest\/?$/,
  /^\/api\/stories\/latest\/?$/,
  /^\/api\/shorts\/latest\/?$/,
];

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isCacheablePublicReadApiRoute(method: string, pathname: string) {
  if (!READ_METHODS.has(method.toUpperCase())) {
    return false;
  }

  return CACHEABLE_PUBLIC_READ_ROUTES.some((pattern) => pattern.test(pathname));
}

export function getRouteScopedApiLimiterPrefix(pathname: string) {
  const routeKey = pathname
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ':')
    .replace(/^:+|:+$/g, '')
    .slice(0, 80);

  return routeKey ? `api:${routeKey}` : 'api';
}
