import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import RateLimiter from '@/lib/security/rateLimiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      windowMs: 1000, // 1 second for faster tests
      maxAttempts: 3,
      blockDurationMs: 2000, // 2 seconds
    });
  });

  afterEach(() => {
    limiter.destroy();
  });

  it('should allow requests within limit', () => {
    const result1 = limiter.check('test-key');
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(2);

    const result2 = limiter.check('test-key');
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(1);

    const result3 = limiter.check('test-key');
    expect(result3.allowed).toBe(true);
    expect(result3.remaining).toBe(0);
  });

  it('should block requests after exceeding limit', () => {
    limiter.check('test-key');
    limiter.check('test-key');
    limiter.check('test-key');

    const result = limiter.check('test-key');
    expect(result.allowed).toBe(false);
    expect(result.isBlocked).toBe(true);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('should track separate keys independently', () => {
    const result1 = limiter.check('key1');
    const result2 = limiter.check('key2');

    expect(result1.allowed).toBe(true);
    expect(result2.allowed).toBe(true);
    expect(result1.remaining).toBe(2);
    expect(result2.remaining).toBe(2);
  });

  it('should reset count after window expires', async () => {
    limiter.check('test-key');
    limiter.check('test-key');

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const result = limiter.check('test-key');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('should block until blockDuration expires', async () => {
    // Fill up the limit
    limiter.check('test-key');
    limiter.check('test-key');
    limiter.check('test-key');

    // Trigger block
    const blockedResult = limiter.check('test-key');
    expect(blockedResult.allowed).toBe(false);
    expect(blockedResult.isBlocked).toBe(true);

    // Should still be blocked immediately
    const stillBlocked = limiter.check('test-key');
    expect(stillBlocked.allowed).toBe(false);

    // Wait for block to expire
    await new Promise((resolve) => setTimeout(resolve, 2100));

    const unblocked = limiter.check('test-key');
    expect(unblocked.allowed).toBe(true);
  });

  it('should provide status information', () => {
    limiter.check('test-key');
    limiter.check('test-key');

    const status = limiter.getStatus('test-key');
    expect(status).toEqual({
      attempts: 2,
      remaining: 1,
      blocked: false,
      blockedUntil: undefined,
    });
  });

  it('should show blocked status correctly', () => {
    limiter.check('test-key');
    limiter.check('test-key');
    limiter.check('test-key');
    limiter.check('test-key'); // Exceed limit

    const status = limiter.getStatus('test-key');
    expect(status?.blocked).toBe(true);
    expect(status?.blockedUntil).toBeDefined();
  });

  it('should reset individual keys', () => {
    limiter.check('test-key');
    limiter.check('test-key');

    let status = limiter.getStatus('test-key');
    expect(status?.attempts).toBe(2);

    limiter.reset('test-key');

    status = limiter.getStatus('test-key');
    expect(status).toBe(null);
  });

  it('should reset all keys', () => {
    limiter.check('key1');
    limiter.check('key2');

    let status1 = limiter.getStatus('key1');
    let status2 = limiter.getStatus('key2');
    expect(status1).not.toBe(null);
    expect(status2).not.toBe(null);

    limiter.resetAll();

    status1 = limiter.getStatus('key1');
    status2 = limiter.getStatus('key2');
    expect(status1).toBe(null);
    expect(status2).toBe(null);
  });

  it('should return null for non-existent keys', () => {
    const status = limiter.getStatus('non-existent');
    expect(status).toBe(null);
  });
});
