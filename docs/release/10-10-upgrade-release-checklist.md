# 10/10 Upgrade Release Checklist

## Before Deploy

- Run `npm run quality:full`.
- Run `npm run verify:prod-env`.
- Confirm `NEXTAUTH_SECRET`, `MONGODB_URI`, and storage credentials are present.
- Confirm CSP reporting endpoint is reachable at `/api/security/csp-report`.
- Confirm `/api/docs/openapi.json` returns JSON.

## Smoke Checks

- Admin sign-in succeeds.
- Admin dashboard, analytics, operations, diagnostics, and API docs load.
- Team invite/update actions write final-status audit entries.
- Public latest feed paginates and sends cache headers.
- Article TTS returns `ready`, `queued`, `processing`, or `failed`.

## Rollback Notes

- API wrapper migration: revert only the migrated route files and keep shared
  helpers in place if other routes use them.
- Request/audit logging: set `DISABLE_REQUEST_LOG=1` or `DISABLE_AUDIT_LOG=1`
  as an emergency runtime mitigation.
- CSP tightening: temporarily relax CSP in `next.config.js` if production
  browser errors block core flows.
- TTS queue: set `TTS_ASYNC_QUEUE_ENABLED=0` to fall back to synchronous
  generation while the worker is repaired.

