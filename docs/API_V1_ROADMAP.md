# API v1 Roadmap

Last reviewed: 2026-05-09

## Goal

API v1 should become the stable contract for the public website, native mobile
app, admin CMS, workers, webhooks, and partner integrations. It should be added
gradually without breaking current routes.

## Proposed Route Structure

```text
/api/v1/public/*
/api/v1/app/*
/api/v1/admin/*
/api/v1/ai/*
/api/v1/webhooks/*
```

## Current v1 Foundation

The repo currently has first compatibility routes under `/api/v1/public`:

- `/api/v1/public/articles/latest`
- `/api/v1/public/articles`
- `/api/v1/public/articles/[slug]`
- `/api/v1/public/breaking`
- `/api/v1/public/categories`
- `/api/v1/public/cities`
- `/api/v1/public/epapers`
- `/api/v1/public/epapers/latest`
- `/api/v1/public/health`
- `/api/v1/public/home-feed`
- `/api/v1/public/search`
- `/api/v1/public/shorts`
- `/api/v1/public/shorts/latest`
- `/api/v1/public/stories/latest`
- `/api/v1/public/videos`
- `/api/v1/public/videos/latest`

These reuse existing handlers to avoid breaking response shapes.

## Public Website APIs

Target routes:

```text
GET /api/v1/public/home-feed
GET /api/v1/public/articles
GET /api/v1/public/articles/[slug]
GET /api/v1/public/categories
GET /api/v1/public/cities
GET /api/v1/public/epapers
GET /api/v1/public/videos
GET /api/v1/public/shorts
GET /api/v1/public/live/current
GET /api/v1/public/breaking
GET /api/v1/public/search
```

Rules:

- Cache shared public data.
- Keep user-specific actions out of public cacheable routes.
- Use cursor pagination for feeds.
- Use projections to avoid sending admin-only fields.

## Mobile App APIs

Target routes:

```text
GET /api/v1/app/feed
GET /api/v1/app/articles/[slug]
GET /api/v1/app/epapers/latest
GET /api/v1/app/live/current
POST /api/v1/app/device-tokens
DELETE /api/v1/app/device-tokens/[id]
GET /api/v1/app/saved-articles
POST /api/v1/app/saved-articles
DELETE /api/v1/app/saved-articles/[id]
GET /api/v1/app/preferences
PATCH /api/v1/app/preferences
```

Rules:

- Mobile auth can use NextAuth-compatible session tokens or signed API tokens.
- Device token writes must be authenticated or anonymous-with-device-id and
  rate limited.
- Offline app feeds should be compact and stable.

## Admin CMS APIs

Target routes:

```text
GET/POST /api/v1/admin/articles
GET/PATCH/DELETE /api/v1/admin/articles/[id]
GET/POST /api/v1/admin/epapers
GET/PATCH /api/v1/admin/epapers/[id]
GET/POST /api/v1/admin/live-streams
GET/POST /api/v1/admin/media
POST /api/v1/admin/workflow/transition
GET /api/v1/admin/review-queue
GET /api/v1/admin/my-work
```

Rules:

- Admin APIs must be no-store.
- Mutations must enforce same-origin/CSRF checks.
- Permission checks must run server-side.
- Mutations should write audit/activity records.

## AI APIs

Target routes:

```text
POST /api/v1/ai/search
POST /api/v1/ai/summary
POST /api/v1/ai/headline-suggestions
POST /api/v1/ai/seo-suggestions
POST /api/v1/ai/hindi-correction
POST /api/v1/ai/recommendations
```

Rules:

- Expensive AI work should create jobs.
- Public AI endpoints need strict rate limits.
- Admin AI endpoints should include editor identity in audit logs.
- AI output should be marked assistive until reviewed by an editor.

## E-paper APIs

Target routes:

```text
GET /api/v1/public/epapers
GET /api/v1/public/epapers/[id]
GET /api/v1/public/epapers/[id]/articles
GET /api/v1/public/epapers/[id]/pdf
POST /api/v1/admin/epapers
POST /api/v1/admin/epapers/[id]/pages
POST /api/v1/admin/epapers/[id]/ocr-jobs
POST /api/v1/admin/epapers/[id]/publish
```

Rules:

- Public e-paper lists can cache for minutes.
- PDF/page image delivery should be CDN-backed.
- OCR and page image work should run through workers.

## Live Streaming APIs

Target routes:

```text
GET /api/v1/public/live/current
GET /api/v1/public/live/[slug]
GET /api/v1/admin/live-streams
POST /api/v1/admin/live-streams
PATCH /api/v1/admin/live-streams/[id]
POST /api/v1/admin/live-streams/[id]/start
POST /api/v1/admin/live-streams/[id]/end
```

Rules:

- Start with YouTube embed metadata.
- Store provider, stream URL/embed ID, schedule, status, sponsor, replay ID.
- Later integrate Mux, Cloudflare Stream, or AWS IVS webhooks.

## Notification APIs

Target routes:

```text
POST /api/v1/app/device-tokens
PATCH /api/v1/app/notification-preferences
POST /api/v1/admin/notifications/send
GET /api/v1/admin/notifications
POST /api/v1/webhooks/notifications/provider
```

Rules:

- Store city/category preferences.
- Queue sends instead of fanout inside admin request handlers.
- Track delivery status and failures.

## Analytics APIs

Target routes:

```text
POST /api/v1/public/analytics/track
GET /api/v1/admin/analytics/overview
GET /api/v1/admin/analytics/content
GET /api/v1/admin/analytics/audience
GET /api/v1/admin/analytics/revenue
```

Rules:

- Public tracking should be rate limited and compact.
- Admin analytics should use rollups for large date ranges.
- Do not store unnecessary personal data.

## Webhook APIs

Target routes:

```text
POST /api/v1/webhooks/storage
POST /api/v1/webhooks/streaming
POST /api/v1/webhooks/social
POST /api/v1/webhooks/payments
```

Rules:

- Verify signatures.
- Store idempotency keys.
- Return quickly and queue heavy work.

## Auth Strategy

### Admin Web

- Continue NextAuth/admin session flow.
- Re-check role permissions in every admin route handler.
- Keep admin writes protected by same-origin checks and audit logging.

### Public Web Users

- Continue reader session flow for saved articles, preferences, and account.
- Keep public feed APIs cacheable and separate from user-personal APIs.

### Mobile App Users

- Add app token/session strategy after API v1 public routes stabilize.
- Support device token registration with user ID when signed in.
- Support anonymous install ID only for notification preferences if needed.

### Webhooks

- Use provider signature verification and timestamp checks.
- Keep webhook secrets separate from admin/user auth secrets.
- Add idempotent event storage before processing.

## Standard Success Response

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "error": null
}
```

## Standard Error Response

```json
{
  "success": false,
  "data": null,
  "meta": {},
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": []
  }
}
```

## Rate Limiting Recommendations

- Public content reads: soft rate limit by IP only if abuse is detected.
- Public forms: strict IP and fingerprint limits.
- AI routes: strict per-IP and per-user limits.
- Admin mutations: per-session throttles plus audit logs.
- Webhooks: provider signature plus idempotency, not only IP.

## Validation Recommendations

- Use the new `lib/api/validation.ts` helpers for new routes.
- Add Zod later if the project accepts the dependency.
- Validate query params, JSON body, IDs, slugs, date ranges, enum values, and
  pagination limits before business logic.
- Return 422 for validation failures.

## Migration Plan

1. Keep legacy routes working.
2. Add v1 route aliases for stable public reads.
3. Add v1-native routes with the standard envelope for new app/mobile features.
4. Move repeated route logic into services.
5. Update OpenAPI as each route becomes stable.
6. Migrate the reader app to v1 only after mobile contracts are settled.

## Execution Order

Use [Platform 2 Phased Execution Plan](./PLATFORM_2_PHASED_EXECUTION_PLAN.md)
as the implementation tracker. The API order is:

1. Public website reads.
2. Reader website migration.
3. Admin CMS v1 routes where they reduce duplication.
4. App/mobile routes.
5. Live, notification, analytics, AI, and webhook routes after their service
   modules are stable.
