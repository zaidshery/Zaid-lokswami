# Lokswami Platform 2 Phased Execution Plan

Last reviewed: 2026-05-12

This is the step-by-step implementation tracker for the Platform 2 docs. The
rule is to finish one stable phase at a time, verify it, then move forward.

## Current Status

| Area | Status | Notes |
| --- | --- | --- |
| Architecture docs | Verified in current worktree | Platform shape, API-first decision, scaling direction, CMS plan, and media roadmap are documented. Commit is still pending. |
| API v1 public foundation | Verified in current worktree | First `/api/v1/public` routes exist for home feed, articles, article detail, latest, categories, cities, search, videos, stories, shorts, e-papers, breaking, and health. Full tests and production build pass. |
| Reader migration to v1 | Verified in current worktree | Homepage, latest, category, videos, and e-paper surfaces use shared request-origin and v1 API contracts for the first migration slice. |
| API utilities | In progress | Shared cache, response, error, validation, OpenAPI, public article, and home-feed helpers exist in the current worktree. |
| CMS 2 shared workflow | Verified in current worktree | Shared workflow badges, review queue filters, and activity timeline UI are applied to the first CMS workflow surfaces. |
| Mobile app APIs | Not started | `/api/v1/app/*` contracts are planned but not implemented. |
| Admin API v1 | Not started | Existing admin APIs remain under current route structure. |
| Live streaming module | Not started | YouTube Live MVP needs model, CMS screen, public API, and reader display. |
| Push notification product module | Not started | Device tokens, preferences, send jobs, and delivery logs are planned. |
| Worker queue layer | Not started | Queue interfaces and worker processes are planned for AI, e-paper, media, notification, search, and social jobs. |
| Analytics rollups | Not started | Existing analytics surfaces need rollups and v1 reporting APIs. |
| Ads/revenue product module | Not started | Revenue page exists, but ad slots/campaigns/reporting need product modeling. |

## Phase 0: Documentation And Foundation Lock

Goal: make the docs and current code agree before adding more platform surface.

Tasks:

1. Keep `docs/README.md` as the entry point.
2. Keep `docs/API_V1.md` limited to routes that exist or are actively being introduced.
3. Keep `docs/API_V1_ROADMAP.md` as the full future contract list.
4. Keep ADR-004 aligned with the real `/api/v1/public` route tree.
5. Exclude runtime logs from commits unless they are intentionally needed.
6. Run typecheck and focused tests for current API/feed work.

Done when:

- Current routes listed in docs match `app/api/v1/public`.
- Docs are committed with the API foundation code.
- Typecheck and focused tests pass.

Current verification:

- 2026-05-12: `cmd /c npm run typecheck` passed.
- 2026-05-12: `cmd /c npm test -- tests/api-foundation-utils.test.ts tests/api/public-home-feed-route.test.ts tests/api/public-v1-articles-routes.test.ts tests/home-feed-mapper.test.ts tests/public-articles-service.test.ts tests/public-home-feed-service.test.ts tests/public-articles-client.test.ts tests/home-page-client-home-feed.test.tsx tests/latest-feed-client-v1.test.tsx tests/category-page-client-v1.test.tsx` passed with 10 test files and 15 tests.
- Remaining Phase 0 action: commit docs and API foundation code when the current
  worktree is ready to publish.

## Phase 1: Public API v1 Completion

Goal: finish the public read API layer for website, PWA, mobile MVP, and
partner-safe public reads.

Tasks:

1. Finish stable service-layer routes:
   - `GET /api/v1/public/home-feed`
   - `GET /api/v1/public/articles`
   - `GET /api/v1/public/articles/[slug]`
   - `GET /api/v1/public/categories`
   - `GET /api/v1/public/cities`
   - `GET /api/v1/public/epapers`
   - `GET /api/v1/public/videos`
   - `GET /api/v1/public/shorts`
   - `GET /api/v1/public/breaking`
   - `GET /api/v1/public/search`
2. Keep legacy routes working.
3. Use shared response/error/validation helpers for new v1-native routes.
4. Add cache headers and tests for public read routes.
5. Update OpenAPI metadata for every stable route.

Done when:

- Public API v1 routes have tests for success, pagination/filters, and failures.
- Cache headers match `docs/PERFORMANCE_AND_SCALING_PLAN.md`.
- Reader pages can use v1 routes without breaking existing pages.

Current verification:

- 2026-05-12: added first Phase 1 route slice for categories, cities, search,
  videos, shorts, and e-papers under `/api/v1/public`.
- 2026-05-12: `cmd /c npm run typecheck` passed.
- 2026-05-12: `cmd /c npm test -- tests/api-foundation-utils.test.ts tests/api/public-home-feed-route.test.ts tests/api/public-v1-articles-routes.test.ts tests/api/public-v1-taxonomy-routes.test.ts tests/home-feed-mapper.test.ts tests/public-articles-service.test.ts tests/public-home-feed-service.test.ts tests/public-articles-client.test.ts tests/home-page-client-home-feed.test.tsx tests/latest-feed-client-v1.test.tsx tests/category-page-client-v1.test.tsx` passed with 11 test files and 20 tests.
- 2026-05-12: `cmd /c npm test` passed with 84 test files and 303 tests.
- 2026-05-12: `cmd /c npm run build:next` passed. Existing lint warnings remain
  in older admin/media files, but the build completed and the new v1 public
  routes were included in the compiled route list.
- Remaining Phase 1 action: add live-current API when Phase 5 live streaming
  begins; do not block the public content API slice on live-streaming models.

## Phase 2: Reader Website Migration And Performance

Goal: move reader surfaces to stable service/API contracts and reduce repeated
page-specific data logic.

Tasks:

1. Use home-feed service for homepage sections.
2. Use public article service for latest and category feeds.
3. Keep article detail SEO server-rendered and cache-friendly.
4. Add route-level loading/error states where missing.
5. Verify e-paper, video, shorts, breaking, and story feeds still render.
6. Add smoke checks for homepage, latest, article detail, category, e-paper,
   videos, and API health.

Done when:

- Reader pages render through shared contracts.
- Typecheck, focused reader tests, and smoke tests pass.
- Public cache behavior is documented and tested.

Current verification:

- 2026-05-12: added shared `lib/server/requestOrigin.ts` helper for server
  reader pages that fetch absolute v1 API URLs.
- 2026-05-12: homepage, latest, category, videos, and e-paper server pages use
  the shared request-origin helper.
- 2026-05-12: videos and e-paper reader list loading now uses v1 public routes
  for initial and client-side fetches.
- 2026-05-12: `cmd /c npm run typecheck` passed.
- 2026-05-12: `cmd /c npm test -- tests/home-page-client-home-feed.test.tsx tests/latest-feed-client-v1.test.tsx tests/category-page-client-v1.test.tsx tests/public-articles-client.test.ts tests/home-feed-mapper.test.ts tests/api/public-v1-articles-routes.test.ts tests/api/public-home-feed-route.test.ts tests/api/public-v1-taxonomy-routes.test.ts` passed with 8 test files and 13 tests.

## Phase 3: CMS 2 Shared Workflow

Goal: make admin newsroom screens more consistent without breaking existing
permissions or workflows.

Tasks:

1. Add shared CMS page patterns only where two or more screens need them.
2. Standardize workflow badges and priority badges.
3. Improve review queue filters.
4. Add activity timeline surfaces to article, story, video, and e-paper edit
   flows.
5. Keep permission checks server-side in route handlers.
6. Keep admin APIs no-store and mutation-audited.

Done when:

- Reporter, copy editor, admin, and super admin paths still work.
- Workflow actions are permission-checked server-side.
- Admin UI is consistent on desktop and mobile.

Current verification:

- 2026-05-12: added `components/admin/CmsWorkflowStatusBadge.tsx` with shared
  status label, content-type label, and workflow tone helpers.
- 2026-05-12: review queue and newsroom operations surfaces use the shared
  workflow status badge instead of local duplicated workflow pill helpers.
- 2026-05-12: added shared priority label, tone, and badge helpers to the same
  CMS workflow badge module.
- 2026-05-12: article edit metadata, e-paper article chips, and video workflow
  metadata use the shared CMS priority badge.
- 2026-05-12: review queue supports server-side content, status, priority, and
  assignment filters through URL query params.
- 2026-05-12: review queue rows now show shared priority badges alongside
  shared workflow status badges.
- 2026-05-12: added shared CMS activity timeline component and applied it to
  article, story, video, and e-paper edit surfaces.
- 2026-05-12: article edit workflow now explains the publish path when the
  current workflow state is not directly publishable.
- 2026-05-12: admin upload route reads form data before cloning the request,
  reducing Hostinger/Undici disturbed-body failures during uploads.
- 2026-05-12: `cmd /c npm run typecheck` passed.
- 2026-05-12: `cmd /c npm test -- tests/article-workflow-overview.test.ts tests/cms-workflow-status-badge.test.tsx tests/newsroom-workflow-transitions.test.ts` passed with 3 test files and 9 tests.
- 2026-05-12: `cmd /c npm test -- tests/api/admin-upload-route.test.ts tests/article-workflow-overview.test.ts` passed with 2 test files and 10 tests.
- 2026-05-12: `cmd /c npm test -- tests/cms-workflow-activity-timeline.test.tsx tests/cms-workflow-status-badge.test.tsx tests/api/admin-article-by-id-route.test.ts tests/api/admin-upload-route.test.ts` passed with 4 test files and 21 tests.
- 2026-05-12: `cmd /c npm test` passed with 86 test files and 312 tests.
- 2026-05-12: `cmd /c npm run build:next` passed. Existing lint warnings remain
  in older admin/media files, but the production build completed.
- Phase 3 is complete in the current worktree. Next phase: Phase 4 mobile app
  APIs and notification foundation.

## Phase 4: Mobile App And Notification Foundation

Goal: prepare real native app support without turning the mobile app into only a
WebView.

Tasks:

1. Add `/api/v1/app/feed`.
2. Add app article and e-paper read routes where public routes are not enough.
3. Add device token model and API.
4. Add notification preference API.
5. Support anonymous install ID first; add signed user support after session
   strategy is finalized.
6. Add rate limiting and validation for token/preference writes.

Done when:

- App APIs have stable envelopes and tests.
- Device token writes are safe, rate-limited, and idempotent.
- Notification preferences can be read and updated.

## Phase 5: Live Streaming MVP

Goal: add a simple live product first, then upgrade providers later.

Tasks:

1. Add live stream model.
2. Add admin live stream list/create/edit screen.
3. Add start/end actions.
4. Add `GET /api/v1/public/live/current`.
5. Add reader live surface using YouTube embed metadata.
6. Track sponsor, schedule, status, and replay fields.

Done when:

- Admin can schedule and manage a live stream.
- Public reader can show current live stream.
- The system can safely show no-live state.

## Phase 6: Worker Queue Layer

Goal: move heavy operations out of request handlers.

Tasks:

1. Add queue abstraction before adding worker runtimes.
2. Add idempotent job records with status, attempts, last error, and timestamps.
3. Add first jobs:
   - `epaper.uploaded`
   - `ai.summary.generate`
   - `search.index`
   - `notification.send`
   - `social.draft.create`
4. Add admin worker status view.
5. Keep request handlers creating records and enqueueing jobs only.

Done when:

- Jobs can be created, retried, and inspected.
- Slow AI/e-paper/notification work is not performed directly in normal admin
  request handlers.

## Phase 7: AI And Search Expansion

Goal: improve newsroom assistance while keeping editorial control.

Tasks:

1. Move summaries, SEO suggestions, embeddings, and transcript summaries into
   queued jobs.
2. Add admin AI job status and error visibility.
3. Add production search strategy using Atlas Search or a dedicated engine.
4. Keep AI output marked as assistive until reviewed.
5. Rate limit public AI/search endpoints.

Done when:

- AI jobs are auditable and retryable.
- Search has a production-ready indexing path.
- AI cannot auto-publish sensitive content.

## Phase 8: Analytics, Ads, And Revenue

Goal: turn existing analytics and revenue surfaces into reliable product modules.

Tasks:

1. Add compact public analytics tracking v1 route if current route needs
   standardization.
2. Add rollups for high-volume analytics dashboards.
3. Add ad slot and campaign models.
4. Add sponsor/ad reporting.
5. Keep editorial and paid content visibly separated.

Done when:

- Admin analytics uses rollups for large ranges.
- Revenue dashboards have reliable campaign/ad-slot data.
- Public tracking avoids unnecessary personal data.

## Phase 9: Native Mobile App

Goal: build the native app after APIs are stable enough to avoid churn.

Tasks:

1. Create Expo React Native app.
2. Build home, latest, article detail, category, video, shorts, and e-paper
   views.
3. Add local saved articles.
4. Add login/session support.
5. Add device push and preferences.
6. Add live stream viewer.

Done when:

- Android MVP can browse current content from API v1.
- Saved/offline basics work.
- Push preferences and live viewer work.

## Phase Rules

- Do not start a later phase by breaking an earlier phase.
- Do not remove legacy routes until the reader site and mobile contract are both
  migrated.
- Do not add service extraction before the monolith boundaries and queue layer
  are stable.
- Do not perform heavy AI, e-paper, media, notification, or social work inside
  normal request handlers once the worker phase begins.
- Keep each phase independently testable and deployable.
