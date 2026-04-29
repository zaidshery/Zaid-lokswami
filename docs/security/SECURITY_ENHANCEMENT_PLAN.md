# Lokswami Security Enhancement Plan

**Date**: April 29, 2026  
**Priority**: High  
**Timeline**: Phase implementation over 2 sprints

---

## Executive Summary

The Lokswami platform has strong RBAC and authentication foundations but lacks critical infrastructure security controls. This plan addresses:
- **Rate limiting** to prevent brute force & DDoS attacks
- **Security headers** for browser-based protections
- **Input validation** to prevent injection attacks
- **Audit logging** for compliance & incident response
- **Request validation** throughout API layer

---

## Current Security Status

### ✅ Strengths
- NextAuth v5 (industry standard)
- JWT + secure session cookies
- 4-role RBAC system
- Middleware route protection
- Password hashing (bcryptjs)

### ⚠️ Gaps
1. **No rate limiting** on auth endpoints (brute force risk)
2. **No security headers** (CSP, X-Frame-Options, etc.)
3. **No input validation patterns** (injection risk)
4. **No audit logging** for admin actions (compliance gap)
5. **No request logging** for forensics

---

## Implementation Roadmap

### Phase 1: Authentication & API Protection (Week 1-2)

#### 1.1 Rate Limiting Middleware
**Goal**: Prevent brute force attacks on login endpoints  
**Implementation**:
- Add `express-rate-limit` or in-memory rate limiter
- 5 failed login attempts = 15-min lockout per IP
- 100 requests/minute per IP on public APIs
- 1000 requests/minute per authenticated user

**Files to create**:
- `lib/security/rateLimiter.ts` — Rate limiting utility
- Update `middleware.ts` to include rate limiting

**Endpoints to protect**:
- `POST /api/auth/signin` (5/15 min per IP)
- `POST /api/auth/callback` (5/15 min per IP)
- `GET /api/articles/latest` (100/min per IP)
- `POST /api/admin/*` (50/min per user)

---

#### 1.2 Security Headers
**Goal**: Add HTTP security headers to all responses  
**Implementation**:
- Configure `next.config.js` with security headers
- CSP (Content Security Policy)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security (HSTS)

**Files to modify**:
- `next.config.js` — Add `async headers()` block

---

### Phase 2: Input Validation & Sanitization (Week 3)

#### 2.1 Input Validation Utility
**Goal**: Centralize validation logic to prevent injection attacks  
**Implementation**:
- Create `lib/security/validation.ts` with common validators
- String length/pattern validation
- Email validation (RFC 5322)
- URL validation (no javascript: protocols)
- MongoDB ObjectID validation

**Validators to include**:
- `validateEmail(email): boolean`
- `validateObjectId(id): boolean`
- `sanitizeString(input): string`
- `validateUrl(url): boolean`
- `validateArticleInput(data): ArticleInput`

---

#### 2.2 API Input Validation Layer
**Goal**: Apply validation to all API endpoints  
**Implementation**:
- Create `lib/security/validateRequest.ts` middleware
- Validate request body, query params, path params
- Reject invalid requests with 400 status
- Log validation failures for suspicious patterns

**Example endpoints to secure**:
- `POST /api/articles` — validate title, content, category
- `POST /api/auth/signin` — validate email format
- `PUT /api/articles/[id]` — validate article fields

---

### Phase 3: Audit Logging (Week 4)

#### 3.1 Admin Action Audit Log
**Goal**: Track all admin actions for compliance  
**Implementation**:
- Create `AuditLog` model
- Log all POST/PUT/DELETE requests by admin users
- Include: user ID, action, resource, timestamp, IP address, changes

**Audit events to capture**:
- Article created/updated/deleted
- User permissions changed
- Settings modified
- E-paper published
- Content moved to different workflow status

**Files to create**:
- `lib/models/AuditLog.ts` — Schema
- `lib/security/auditLogger.ts` — Logging utility

---

#### 3.2 Authentication Audit Log
**Goal**: Track login attempts & session events  
**Implementation**:
- Log successful logins (user, timestamp, IP, device)
- Log failed login attempts (email, timestamp, IP, reason)
- Log session creation/termination
- Alert on suspicious patterns (multiple IPs same user)

---

### Phase 4: Request Logging & Monitoring (Week 5)

#### 4.1 Request Logger Middleware
**Goal**: Enable forensics & incident response  
**Implementation**:
- Create `lib/security/requestLogger.ts`
- Log all API requests: method, path, status, duration, user
- Exclude sensitive fields (passwords, tokens)
- Implement log rotation (daily files)

**Log format** (JSON):
```json
{
  "timestamp": "2026-04-29T10:30:00Z",
  "method": "POST",
  "path": "/api/articles",
  "status": 201,
  "duration": 245,
  "userId": "user123",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

---

## Implementation Order (Priority-based)

| Priority | Task | Effort | Impact | Start |
|----------|------|--------|--------|-------|
| **P0** | Rate limiting on auth endpoints | 2h | Critical | Week 1 |
| **P0** | Security headers | 1h | High | Week 1 |
| **P1** | Input validation utility | 4h | High | Week 2 |
| **P1** | Apply validation to critical endpoints | 6h | High | Week 2 |
| **P2** | Audit logging for admin actions | 4h | Medium | Week 3 |
| **P2** | Authentication audit log | 2h | Medium | Week 3 |
| **P3** | Request logging middleware | 3h | Medium | Week 4 |

---

## Testing Strategy

### Unit Tests
- Rate limiter resets properly
- Validators reject invalid inputs
- Audit logger formats correctly

### Integration Tests
- Rate limiting blocks after threshold
- Security headers present in responses
- Invalid requests rejected with 400

### Load Tests
- Rate limiter doesn't impact performance <100ms
- Audit logging doesn't slow requests >10ms

### Security Tests
- CSP blocks inline scripts
- Brute force attack fails after 5 attempts
- SQL/NoSQL injection payloads rejected

---

## Monitoring & Alerts

### Key Metrics to Track
- Failed login attempts per IP (alert if >10/5min)
- Rate limit hits (track patterns)
- Invalid input attempts (detect attacks)
- Audit log volume (normal baseline)

### Alert Thresholds
- 10+ failed logins from single IP → Block IP
- 5+ validation errors same user → Notify admin
- Admin deletes >10 items in 1 hour → Log & review

---

## Compliance & Standards

**Standards addressed**:
- ✅ OWASP Top 10 (A01-Injection, A07-Authentication)
- ✅ GDPR (audit trails for user actions)
- ✅ Indian DPDP Act (data protection logging)

---

## Success Criteria

- [x] All auth endpoints rate-limited
- [x] Security headers present on all responses
- [x] 100% of admin API endpoints validated
- [x] All admin actions logged & auditable
- [x] Zero injection vulnerabilities in tests
- [x] <50ms latency overhead from security layers

---

## Rollback Plan

Each phase can be rolled back independently:
1. **Rate limiter**: Disable in middleware config
2. **Security headers**: Remove from `next.config.js`
3. **Validation**: Feature flag in `validateRequest.ts`
4. **Audit logging**: Set `DISABLE_AUDIT_LOG=true`
5. **Request logging**: Set `DISABLE_REQUEST_LOG=true`

---

## Post-Implementation Review

Schedule security review after Phase 1:
- Penetration testing on auth endpoints
- OWASP vulnerability scan
- Rate limit effectiveness validation
