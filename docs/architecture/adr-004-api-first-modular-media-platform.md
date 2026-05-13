# ADR 004: API-First Modular Media Platform

## Status

Accepted

## Context

Lokswami is no longer only a reader website. The same codebase now supports a
public news PWA, admin newsroom CMS, e-paper workflows, video/story feeds,
manual audio uploads, AI-assisted tools, analytics, and security logging.

The next platform phase needs stable APIs for the reader site, mobile app,
automation workers, live coverage, notifications, and future partner tools.
Splitting into many services now would add deployment and coordination cost
before the team needs that complexity.

## Decision

Use an API-first modular media platform architecture:

- keep the Next.js + MongoDB modular monolith as the deployable core
- expose stable public APIs under `app/api/v1/public`
- keep protected admin APIs under admin route groups until they are migrated
- move business rules into `lib/server`, `lib/services`, and storage helpers
- keep public reader APIs cacheable by default
- keep admin, auth, upload, and user-personal APIs private and uncached
- move heavy work into queue/worker modules before it blocks request latency

The long-term shape is:

```text
Next.js reader/admin
  -> API v1 layer
  -> service modules
  -> MongoDB metadata
  -> cloud media storage/CDN
  -> workers for AI, media, notification, search, and e-paper jobs
```

## Current API v1 Foundation

The first v1 public routes are compatibility entrypoints over the current
reader APIs:

- `/api/v1/public/articles/latest`
- `/api/v1/public/articles`
- `/api/v1/public/articles/[slug]`
- `/api/v1/public/categories`
- `/api/v1/public/cities`
- `/api/v1/public/epapers`
- `/api/v1/public/health`
- `/api/v1/public/home-feed`
- `/api/v1/public/search`
- `/api/v1/public/stories/latest`
- `/api/v1/public/videos`
- `/api/v1/public/videos/latest`
- `/api/v1/public/shorts`
- `/api/v1/public/shorts/latest`
- `/api/v1/public/epapers/latest`
- `/api/v1/public/breaking`

These routes intentionally reuse the existing response shapes. A later cleanup
can add a standard response envelope once the website and mobile app can migrate
together.

## Speed Policy

Public reader feeds should be CDN/cache friendly:

- breaking feed: 20 second shared cache
- article, story, video, and shorts feeds: 60 second shared cache
- article detail: 120 second shared cache
- e-paper feed: 5 minute shared cache
- stale responses can be served while the next response revalidates

Private and mutation routes must not use public cache headers.

## Worker Policy

These jobs should not run in normal request/response paths:

- e-paper PDF conversion, OCR, and page image generation
- local summaries, editorial checklists, OCR cleanup, and transcription
- push notification fanout
- social post creation and dispatch
- video thumbnail/transcoding workflows
- search indexing and recommendation refreshes

Request handlers should create records and enqueue work; workers should perform
slow external calls and update job status.

## Consequences

This keeps Lokswami simple to deploy while making the platform ready for mobile,
live, notifications, search, automation, and future service extraction.
