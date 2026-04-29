# Lokswami 10/10 Practical Quality Scorecard

This scorecard defines "10/10" for the current newsroom scale: a secure, fast,
maintainable Next.js + MongoDB monolith without adding Redis, paid monitoring,
or microservices before the product needs them.

## Quality Gate

Pass requires:

- `npm run typecheck`
- `npm run lint:strict`
- `npm run test:security`
- `npm run test:governance`
- `npm run test:four-role-newsroom`
- `npm run build:ci`

Run all checks with:

```bash
npm run quality:full
```

## Functionality

10/10 means:

- Admin, reporter, copy editor, and reader flows are covered by tests.
- Critical newsroom paths have clear empty states and mobile-safe screens.
- Article creation works on mobile without layout overflow.
- TTS returns explicit `ready`, `queued`, `processing`, or `failed` states.
- Analytics and operations are separated so daily work stays focused.

## Architecture

10/10 means:

- The monolith remains the default deployment unit.
- Route handlers stay thin and delegate shared behavior to `lib/api`,
  `lib/security`, and `lib/server`.
- New async work uses MongoDB-backed job state before adding new infrastructure.
- Architecture decisions are recorded under `docs/architecture`.

## Performance

10/10 means:

- Public read endpoints send explicit cache headers.
- Hot queries use limits, projections, and lean documents where possible.
- Slow API routes are visible in request logs and diagnostics.
- Blocking TTS generation is replaced by queued responses and worker execution.
- Public payloads are bounded and pagination is regression-tested.

## Security

10/10 means:

- Admin mutations use shared auth, same-origin checks, normalized errors,
  validation, request logging, and final-status audit logging.
- CSP is reportable and production does not allow `unsafe-eval`.
- Rate-limit, validation, audit, request log, and header regressions are tested.
- Logs redact secrets and token-like query values.

## Maintainability

10/10 means:

- Quality scripts are easy to run locally and before deploy.
- API contracts are documented at `/api/docs/openapi.json`.
- Admin API docs are available at `/admin/api-docs`.
- Release and rollback checklists exist for risky systems.
- Root-level planning docs are organized under `docs/` instead of deleted.

