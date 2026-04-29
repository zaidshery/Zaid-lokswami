/**
 * Singleton instances for different rate limiting concerns
 * Each concern gets its own limiter instance for independent tracking
 */

import RateLimiter from './rateLimiter';

// Shared instances
let loginLimiter: RateLimiter | null = null;
let apiLimiter: RateLimiter | null = null;
let adminLimiter: RateLimiter | null = null;

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
 * Limits: 100 requests per minute per IP
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
 * Limits: 200 requests per minute per user
 */
export function getAdminLimiter(): RateLimiter {
  if (!adminLimiter) {
    adminLimiter = new RateLimiter({
      windowMs: 60 * 1000, // 1 minute
      maxAttempts: 200,
      blockDurationMs: 10 * 60 * 1000, // 10 minute block
      keyPrefix: 'admin',
    });
  }
  return adminLimiter;
}

/**
 * Reset all rate limiters (for testing or emergency purposes)
 */
export function resetAllLimiters() {
  loginLimiter?.resetAll();
  apiLimiter?.resetAll();
  adminLimiter?.resetAll();
}

/**
 * Cleanup all limiter instances
 */
export function destroyAllLimiters() {
  loginLimiter?.destroy();
  apiLimiter?.destroy();
  adminLimiter?.destroy();

  loginLimiter = null;
  apiLimiter = null;
  adminLimiter = null;
}
