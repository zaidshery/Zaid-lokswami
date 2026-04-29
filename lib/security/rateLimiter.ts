/**
 * In-memory rate limiter for protecting sensitive endpoints
 * Tracks requests per IP/user and enforces limits
 */

interface RateLimitEntry {
  attempts: number;
  lastAttempt: number;
  blockedUntil?: number;
}

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxAttempts: number; // Max attempts per window
  blockDurationMs: number; // How long to block after exceeding limit
  keyPrefix: string; // Prefix for tracking (e.g., 'login', 'api')
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxAttempts: 5,
  blockDurationMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'rl',
};

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanup();
  }

  /**
   * Check if a request should be allowed
   * @returns { allowed: boolean, retryAfter?: number, remaining?: number }
   */
  check(key: string): {
    allowed: boolean;
    retryAfter?: number;
    remaining?: number;
    isBlocked?: boolean;
  } {
    const now = Date.now();
    const entry = this.store.get(key) || {
      attempts: 0,
      lastAttempt: now,
    };

    // Check if currently blocked
    if (entry.blockedUntil && now < entry.blockedUntil) {
      return {
        allowed: false,
        isBlocked: true,
        retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
      };
    }

    // Reset if window expired
    if (now - entry.lastAttempt > this.config.windowMs) {
      entry.attempts = 0;
    }

    entry.attempts += 1;
    entry.lastAttempt = now;

    // Check if limit exceeded
    if (entry.attempts > this.config.maxAttempts) {
      entry.blockedUntil = now + this.config.blockDurationMs;
      this.store.set(key, entry);

      return {
        allowed: false,
        isBlocked: true,
        retryAfter: Math.ceil(this.config.blockDurationMs / 1000),
      };
    }

    this.store.set(key, entry);

    return {
      allowed: true,
      remaining: this.config.maxAttempts - entry.attempts,
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.store.clear();
  }

  /**
   * Get current status for a key (for debugging/monitoring)
   */
  getStatus(key: string) {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    return {
      attempts: entry.attempts,
      remaining: Math.max(0, this.config.maxAttempts - entry.attempts),
      blocked: entry.blockedUntil ? now < entry.blockedUntil : false,
      blockedUntil: entry.blockedUntil,
    };
  }

  /**
   * Cleanup expired entries periodically to prevent memory leaks
   */
  private startCleanup() {
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      for (const [key, entry] of this.store.entries()) {
        // Delete if not blocked and window expired, or if blocked and unblock time passed
        const windowExpired = now - entry.lastAttempt > this.config.windowMs;
        const blockExpired = entry.blockedUntil && now > entry.blockedUntil + this.config.windowMs;

        if (windowExpired || blockExpired) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach((key) => this.store.delete(key));
    }, 5 * 60 * 1000);
  }

  /**
   * Stop cleanup interval (for testing/cleanup)
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

export default RateLimiter;
export type { RateLimitConfig };
