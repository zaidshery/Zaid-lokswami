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
