import { headers } from 'next/headers';

function normalizeBaseUrl(raw: string) {
  const fallback = 'http://localhost:3000';
  if (!raw) return fallback;

  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return fallback;
  }
}

function normalizeHeaderValue(raw: string | null) {
  return String(raw || '')
    .split(',')
    .map((value) => value.trim())
    .find(Boolean) || '';
}

function isLocalHostname(value: string) {
  const raw = value.trim().toLowerCase();
  let hostname = raw;

  try {
    hostname = new URL(raw.includes('://') ? raw : `http://${raw}`).hostname;
  } catch {
    hostname = raw.split(':')[0] || raw;
  }

  const normalized = hostname.replace(/^\[|\]$/g, '');
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '0.0.0.0'
  );
}

function isLocalOrigin(value: string) {
  try {
    return isLocalHostname(new URL(value).hostname);
  } catch {
    return true;
  }
}

function resolveConfiguredPublicOrigin() {
  const candidates = [process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXTAUTH_URL];

  for (const candidate of candidates) {
    const normalized = normalizeBaseUrl(candidate || '');
    if (!isLocalOrigin(normalized)) {
      return normalized;
    }
  }

  return normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || '');
}

export function resolveShareRequestOrigin(request: Pick<Request, 'headers' | 'url'>) {
  const forwardedHost = normalizeHeaderValue(request.headers.get('x-forwarded-host'));
  const forwardedProto = normalizeHeaderValue(request.headers.get('x-forwarded-proto'));
  const configuredOrigin = resolveConfiguredPublicOrigin();

  if (forwardedHost) {
    const proto = forwardedProto || (isLocalHostname(forwardedHost) ? 'http' : 'https');
    const forwardedOrigin = normalizeBaseUrl(`${proto}://${forwardedHost}`);
    if (!isLocalOrigin(forwardedOrigin)) {
      return forwardedOrigin;
    }

    if (!isLocalOrigin(configuredOrigin)) {
      return configuredOrigin;
    }
  }

  try {
    const url = new URL(request.url);
    if (!isLocalHostname(url.hostname)) {
      return url.origin;
    }
  } catch {
    // Fall through to host/configured origin resolution below.
  }

  if (!isLocalOrigin(configuredOrigin)) {
    return configuredOrigin;
  }

  const host = normalizeHeaderValue(request.headers.get('host'));
  if (host) {
    const proto = forwardedProto || (isLocalHostname(host) ? 'http' : 'https');
    return `${proto}://${host}`;
  }

  return configuredOrigin;
}

export async function resolveRequestOrigin() {
  const headerStore = await headers();
  const forwardedHost = headerStore.get('x-forwarded-host');
  const host = forwardedHost || headerStore.get('host');
  const forwardedProto = headerStore.get('x-forwarded-proto');

  if (host) {
    const proto =
      forwardedProto ||
      (host.includes('localhost') || host.startsWith('127.0.0.1')
        ? 'http'
        : 'https');
    return `${proto}://${host}`;
  }

  return normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || '');
}
