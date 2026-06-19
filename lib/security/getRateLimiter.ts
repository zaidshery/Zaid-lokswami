/**
 * Singleton instances for different rate limiting concerns
 * Each concern gets its own limiter instance for independent tracking
 */

import RateLimiter from './rateLimiter';

// Shared instances
let loginLimiter: RateLimiter | null = null;
let apiLimiter: RateLimiter | null = null;
let adminLimiter: RateLimiter | null = null;
let heavyRouteLimiter: RateLimiter | null = null;

/**
 * Get or create the login rate limiter
 * Limits: 5 attempts per 15 minutes per IP
 */
export function getLoginLimiter(): RateLimiter {
  if (!loginLimiter) {
    loginLimiter = new RateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxAttempts: 5,
      blockDurationMs: 15 * 60 * 1000,
      keyPrefix: 'login',
    });
  }
  return loginLimiter;
}

/**
 * Get or create the public API rate limiter
 * Limits: 100 requests per minute per route/IP for non-cacheable public APIs
 */
export function getApiLimiter(): RateLimiter {
  if (!apiLimiter) {
    apiLimiter = new RateLimiter({
      windowMs: 60 * 1000, // 1 minute
      maxAttempts: 100,
      blockDurationMs: 5 * 60 * 1000, // 5 minute block
      keyPrefix: 'api',
    });
  }
  return apiLimiter;
}

/**
 * Get or create the admin/authenticated rate limiter
 * Limits: 20000 requests per minute per user
 */
export function getAdminLimiter(): RateLimiter {
  if (!adminLimiter) {
    adminLimiter = new RateLimiter({
      windowMs: 60 * 1000, // 1 minute
      maxAttempts: 20000,
      blockDurationMs: 10 * 60 * 1000, // 10 minute block
      keyPrefix: 'admin_v2',
    });
  }
  return adminLimiter;
}

/**
 * Get or create the heavy route limiter
 * Limits: 20 expensive operations per minute per feature and user/IP
 */
export function getHeavyRouteLimiter(): RateLimiter {
  if (!heavyRouteLimiter) {
    heavyRouteLimiter = new RateLimiter({
      windowMs: 60 * 1000, // 1 minute
      maxAttempts: 20,
      blockDurationMs: 60 * 1000, // 1 minute cooldown
      keyPrefix: 'heavy_v2',
    });
  }
  return heavyRouteLimiter;
}

/**
 * Reset all rate limiters (for testing or emergency purposes)
 */
export function resetAllLimiters() {
  loginLimiter?.resetAll();
  apiLimiter?.resetAll();
  adminLimiter?.resetAll();
  heavyRouteLimiter?.resetAll();
}

/**
 * Cleanup all limiter instances
 */
export function destroyAllLimiters() {
  loginLimiter?.destroy();
  apiLimiter?.destroy();
  adminLimiter?.destroy();
  heavyRouteLimiter?.destroy();

  loginLimiter = null;
  apiLimiter = null;
  adminLimiter = null;
  heavyRouteLimiter = null;
}
