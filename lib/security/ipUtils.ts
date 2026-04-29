/**
 * Utility to extract client IP address from request
 * Handles various proxy scenarios (Cloudflare, AWS ALB, Vercel, etc.)
 */

import type { NextRequest } from 'next/server';

/**
 * Extract client IP from NextRequest
 * Checks multiple headers in order of reliability
 */
export function getClientIp(request: NextRequest): string {
  // Check for Cloudflare
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;

  // Check for AWS ALB / API Gateway
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first
    return xForwardedFor.split(',')[0].trim();
  }

  // Check for other proxies
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) return xRealIp;

  // Fallback: try to get from request headers or default
  return request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
}

/**
 * Normalize IP for rate limiting key
 * Removes port and normalizes format
 */
export function normalizeIp(ip: string): string {
  if (!ip || ip === 'unknown') return 'unknown';

  // Remove port if present (IPv4:port or [IPv6]:port)
  if (ip.includes(':') && !ip.includes('[')) {
    return ip.split(':')[0];
  }

  if (ip.startsWith('[')) {
    return ip.split(']')[0] + ']';
  }

  return ip;
}

/**
 * Get rate limiting key for IP-based limiting
 */
export function getIpRateLimitKey(request: NextRequest, prefix: string): string {
  const ip = getClientIp(request);
  const normalized = normalizeIp(ip);
  return `${prefix}:ip:${normalized}`;
}

/**
 * Get rate limiting key for user-based limiting
 */
export function getUserRateLimitKey(userId: string, prefix: string): string {
  return `${prefix}:user:${userId}`;
}
