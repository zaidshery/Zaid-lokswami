# Rate Limiter Integration Guide

Quick reference for using rate limiting in your API routes.

## Quick Start

### Apply Rate Limiting to an API Route

```typescript
// app/api/your-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getApiLimiter } from '@/lib/security/getRateLimiter';
import { getIpRateLimitKey } from '@/lib/security/ipUtils';

export async function POST(request: NextRequest) {
  // Check rate limit
  const apiLimiter = getApiLimiter();
  const ipKey = getIpRateLimitKey(request, 'my-api');
  const result = apiLimiter.check(ipKey);

  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfter || 300),
        },
      }
    );
  }

  // Your endpoint logic here
  return NextResponse.json({ success: true });
}
```

---

## Use Cases

### User-Based Rate Limiting

For authenticated endpoints, rate limit per user instead of IP:

```typescript
import { getUserRateLimitKey } from '@/lib/security/ipUtils';

// In your API route:
const session = await getSession(request);
const userKey = getUserRateLimitKey(session.userId, 'admin-api');
const result = adminLimiter.check(userKey);
```

---

### Custom Rate Limiter

For special endpoints with different limits:

```typescript
import RateLimiter from '@/lib/security/rateLimiter';

// Create custom limiter for sensitive operation
const sensitiveOpLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000,    // 1 hour
  maxAttempts: 3,               // 3 attempts max
  blockDurationMs: 24 * 60 * 1000, // 24 hour block
  keyPrefix: 'sensitive-op',
});

// Use in route:
const result = sensitiveOpLimiter.check(ipKey);
if (!result.allowed) {
  return NextResponse.json(
    { error: 'Operation locked. Try again later.' },
    { status: 429 }
  );
}
```

---

## Available Limiters

### 1. Login Limiter (Built-in)
- **Limit**: 5 attempts per 15 minutes per IP
- **Block Duration**: 15 minutes
- **Use**: Auth endpoints
- **Get**: `getLoginLimiter()`

```typescript
const loginLimiter = getLoginLimiter();
const result = loginLimiter.check(ipKey);
```

### 2. API Limiter (Built-in)
- **Limit**: 100 requests per minute per IP
- **Block Duration**: 5 minutes
- **Use**: Public API endpoints
- **Get**: `getApiLimiter()`

```typescript
const apiLimiter = getApiLimiter();
const result = apiLimiter.check(ipKey);
```

### 3. Admin Limiter (Built-in)
- **Limit**: 200 requests per minute per user
- **Block Duration**: 10 minutes
- **Use**: Admin/authenticated endpoints
- **Get**: `getAdminLimiter()`

```typescript
const adminLimiter = getAdminLimiter();
const result = adminLimiter.check(userKey);
```

---

## API Reference

### RateLimiter.check(key)

Check if a request is allowed.

**Parameters:**
- `key` (string): Unique identifier (IP, user ID, etc.)

**Returns:**
```typescript
{
  allowed: boolean;        // true = request allowed
  retryAfter?: number;     // seconds to wait (if blocked)
  remaining?: number;      // attempts remaining
  isBlocked?: boolean;     // true = currently in lockout
}
```

**Example:**
```typescript
const result = limiter.check('user:123');
if (!result.allowed) {
  console.log(`Blocked. Retry in ${result.retryAfter} seconds`);
}
```

---

### RateLimiter.reset(key)

Manually reset a specific key's count.

```typescript
limiter.reset('user:123');  // Clear rate limit for user 123
```

---

### RateLimiter.resetAll()

Clear all rate limit data.

```typescript
limiter.resetAll();  // Emergency override
```

---

### RateLimiter.getStatus(key)

Get current status for debugging/monitoring.

**Returns:**
```typescript
{
  attempts: number;       // Current attempts
  remaining: number;      // Attempts remaining
  blocked: boolean;       // Is currently blocked?
  blockedUntil?: number;  // Timestamp when block expires
} | null                  // null = key not tracked
```

**Example:**
```typescript
const status = limiter.getStatus('user:123');
if (status?.blocked) {
  const when = new Date(status.blockedUntil!);
  console.log(`Blocked until ${when.toISOString()}`);
}
```

---

## Common Patterns

### Pattern 1: Simple IP-Based Rate Limiting

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getApiLimiter } from '@/lib/security/getRateLimiter';
import { getIpRateLimitKey } from '@/lib/security/ipUtils';

export async function GET(request: NextRequest) {
  const limiter = getApiLimiter();
  const key = getIpRateLimitKey(request, 'search');
  
  if (!limiter.check(key).allowed) {
    return NextResponse.json(
      { error: 'Too many searches' },
      { status: 429 }
    );
  }

  return NextResponse.json({ results: [] });
}
```

---

### Pattern 2: User-Based Rate Limiting

```typescript
import { auth } from '@/auth';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limiter = getAdminLimiter();
  const userKey = getUserRateLimitKey(session.user.id, 'export-data');
  
  if (!limiter.check(userKey).allowed) {
    return NextResponse.json(
      { error: 'Too many exports. Please try later.' },
      { status: 429 }
    );
  }

  // Process export...
  return NextResponse.json({ id: 'export-123' });
}
```

---

### Pattern 3: Tiered Rate Limiting

Apply different limits based on authentication:

```typescript
export async function POST(request: NextRequest) {
  const session = await auth();
  
  let limiter, key;
  
  if (session?.user?.id) {
    // Authenticated: higher limit
    limiter = getAdminLimiter();
    key = getUserRateLimitKey(session.user.id, 'api');
  } else {
    // Anonymous: stricter limit
    limiter = getApiLimiter();
    key = getIpRateLimitKey(request, 'api');
  }

  if (!limiter.check(key).allowed) {
    return NextResponse.json(
      { error: 'Rate limited' },
      { status: 429 }
    );
  }

  // Process request...
}
```

---

## Testing Rate Limiting

### Unit Tests

```typescript
import RateLimiter from '@/lib/security/rateLimiter';

describe('My API with rate limiting', () => {
  it('should allow requests within limit', () => {
    const limiter = new RateLimiter({
      windowMs: 1000,
      maxAttempts: 3,
    });

    const r1 = limiter.check('test');
    const r2 = limiter.check('test');
    const r3 = limiter.check('test');
    
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
  });

  it('should block after exceeding limit', () => {
    const limiter = new RateLimiter({
      windowMs: 1000,
      maxAttempts: 3,
    });

    limiter.check('test');
    limiter.check('test');
    limiter.check('test');
    
    const blocked = limiter.check('test');
    expect(blocked.allowed).toBe(false);
    expect(blocked.isBlocked).toBe(true);
  });
});
```

---

## Performance Considerations

- **Memory**: ~5KB per unique tracked key
- **CPU**: O(1) lookup + cleanup every 5 minutes
- **Latency**: <1ms per check (map lookup + timestamp comparison)

For high-traffic endpoints (1M+ requests/day), use a smaller `windowMs` and distribute across servers.

---

## Troubleshooting

### "Rate limit blocks all requests"

Check your key generation:
```typescript
// ❌ Wrong - same key for all requests
const key = 'global';

// ✅ Correct - per-IP or per-user
const key = getIpRateLimitKey(request, 'api');
```

### "Rate limits not resetting"

Ensure the window hasn't expired:
```typescript
// Check current status
const status = limiter.getStatus(key);
console.log(status);

// Manual reset if needed
limiter.reset(key);
```

### "Out of memory"

Monitor limiter size and increase cleanup interval:
```typescript
// Cleanup more frequently (default: 5 minutes)
// Edit getRateLimiter.ts: 5 * 60 * 1000 → 2 * 60 * 1000
```

---

## Questions?

See [SECURITY_ENHANCEMENT_PLAN.md](SECURITY_ENHANCEMENT_PLAN.md) for full architecture.
