# Lokswami Platform 2 Architecture

Last reviewed: 2026-05-09

## Current Architecture Summary

Lokswami is a Next.js 15 App Router modular monolith. The repo currently has:

- Route groups for `(reader)`, `(admin)`, `(auth)`, and `(marketing)`.
- 118 API route files under `app/api`.
- 30 Mongoose model files under `lib/models`.
- Public reader pages for homepage, latest, categories, article detail, search,
  e-paper, stories, videos, account, saved articles, and marketing pages.
- Admin CMS pages for articles, stories, videos, e-papers, categories, media,
  polls, AI ops, analytics, social posts, review queue, my work, copy desk,
  assignments, operations, team, settings, revenue, and audit log.
- MongoDB/Mongoose as the main persistence layer, with file-store fallbacks for
  some local/degraded flows.
- DigitalOcean Spaces upload utilities, Cloudinary URL compatibility, e-paper
  PDF/image support, and TTS asset storage.
- Local retrieval, extractive summaries, manual audio, and editorial assistant
  surfaces that do not require paid external AI APIs.
- Security modules for audit logging, request logging, rate limiting, anti-bot,
  CSP reports, request validation, and IP handling.
- Deployment scripts for Hostinger standalone builds, smoke checks, env
  validation, rollback, and runtime start.

The system is already more than a normal news website. The right upgrade path is
to keep the monolith, strengthen module boundaries, add stable API contracts,
and move heavy jobs to workers only when needed.

## Target Architecture

Use an API-first modular media platform architecture:

```text
Lokswami Platform
  Public Website + PWA
  Admin Newsroom CMS
  E-paper System
  Video / Shorts
  AI / Search
  Notifications
  Analytics
  Ads / Revenue
  Mobile App API
  Worker / Automation Layer
  Media Storage + CDN
```

Technical shape:

```text
Next.js modular monolith core
  + API-first backend
  + CDN/cache-first public delivery
  + event-driven workers
  + managed media/live providers
  + mobile-app-ready API layer
```

## Architecture Diagram

```text
Readers / Mobile Users / Admins / Reporters / Advertisers
                 |
                 v
       Next.js Website + Admin CMS
                 |
                 v
          /api/v1 entrypoints
                 |
                 v
  -------------------------------------------------
  | articles | epapers | videos | live | AI/search |
  | users    | ads     | media  | CMS  | analytics |
  -------------------------------------------------
                 |
                 v
       Service modules in lib/server and lib/*
                 |
      -------------------------------
      | MongoDB | DigitalOcean Spaces |
      | file fallback | AI providers  |
      -------------------------------
                 |
                 v
  Future workers: media, e-paper, AI, push, social, search
```

## Core Modules

### Reader Website

Current state:

- Reader route group has homepage, latest, categories, article detail, search,
  e-paper, stories, videos, saved/account/preferences, and legal pages.
- Public feeds now have cache helpers, first v1 compatibility routes, and a
  service-layer `/api/v1/public/home-feed` endpoint.

Target:

- Keep SEO pages mostly server-rendered.
- Use cached public APIs for shared feeds.
- Keep user-specific actions separate and no-store.
- Add route-level loading, error, and skeleton states where missing.

### Admin CMS

Current state:

- Admin shell and role-aware pages already exist.
- Workflow routes and models exist for articles, stories, videos, and e-paper.
- Audit, analytics, operations, team, settings, and review surfaces exist.

Target:

- Standardize CMS screens around shared page shell, page header, filters,
  tables, mobile list cards, workflow badges, activity timeline, and review
  actions.
- Continue enforcing permissions in route handlers, not only UI.

### E-paper

Current state:

- E-paper model includes city, publish date, pages, production status,
  assignment, QA metadata, source metadata, embeddings, and AI summary.
- APIs exist for upload, import, OCR, page images, articles, TTS, and public
  latest/detail/PDF access.

Target:

- Move PDF conversion, page image generation, OCR, and article extraction to
  workers.
- Keep CMS request handlers focused on record creation, signed upload, and job
  status.

### Articles

Current state:

- Article model includes SEO metadata, revisions, workflow, reporter/copy-editor
  metadata, embeddings, AI summary, breaking TTS, and indexes for publishing and
  workflow queues.
- Public latest and detail APIs exist, plus manual article audio upload support.

Target:

- Add mobile/app-friendly article APIs under `/api/v1`.
- Standardize response envelopes gradually.
- Move AI summary, search indexing, and social draft generation to workers.

### Videos and Shorts

Current state:

- Single `Video` model handles normal videos and shorts through `isShort`.
- Public latest video and shorts routes exist.
- Story video upload and production tracking exist.

Target:

- Add video asset metadata, processing state, thumbnails, transcripts, and
  provider IDs.
- Use managed transcoding/video provider before attempting in-house streaming.

### Live Streaming

Current state:

- No full live streaming module was found.
- Existing code has YouTube URL helpers and election live/final graphic modes.

Target:

- Stage 1: YouTube Live embed and CMS live event record.
- Stage 2: Mux or Cloudflare Stream for owned live playback.
- Stage 3: AWS IVS if ultra-low latency interaction is needed.

### AI and Search

Current state:

- Local retrieval, content indexing, extractive summaries, assistant UI, and
  manual TTS/audio modules exist.
- Article/e-paper/video/story schemas include embedding and AI summary fields.

Target:

- Keep AI as editor-assist, not auto-publish.
- Move long-running AI generation into queued jobs.
- Add MongoDB Atlas Search or a dedicated search engine for production search.

### Notifications

Current state:

- Leadership report email/webhook notifications exist.
- Admin push alert page exists, but public/mobile push token infrastructure is
  not yet a complete product module.

Target:

- Add device token storage and preference APIs.
- Use Firebase Cloud Messaging or OneSignal for transport.
- Send push via worker jobs, not request handlers.

### Analytics

Current state:

- Analytics event model and public tracking route exist.
- Admin analytics dashboards, exports, leadership reports, and delivery
  diagnostics exist.

Target:

- Keep raw events append-only.
- Add dashboards for audience, content, campaigns, e-paper, video, live, and
  push performance.
- Add retention rules and rollups before event volume grows.

### Ads

Current state:

- Revenue admin page and advertise inquiry flow exist.
- Full ad slot/campaign models were not found in the current inspected model
  list.

Target:

- Add ad slots, campaigns, sponsor labels, inventory rules, reporting, and safe
  editorial separation.

### Workers

Current state:

- Some automation exists in `lib/server`, admin routes, and cron-like routes.
- No dedicated `workers/` runtime was found.

Target:

- Add queue interfaces first, then worker processes.
- Start with e-paper and AI jobs because they are the heaviest.

### Mobile App

Current state:

- No native app package exists in this repo.
- Public APIs and v1 compatibility routes are the correct first step.

Target:

- Expo React Native app consuming `/api/v1/public` and `/api/v1/app` routes.
- Do not ship only a WebView app.

## What Stays Inside The Main Next.js App

- Public website rendering and SEO pages.
- Admin CMS UI and route handlers.
- Auth, sessions, roles, and permission enforcement.
- Lightweight public APIs.
- Content CRUD and workflow state transitions.
- Health, smoke, deployment validation, and admin diagnostics.

## What Later Moves To Workers Or Services

- PDF to image conversion.
- OCR and e-paper article extraction.
- Local summaries, search indexing, OCR cleanup, and editorial checklists.
- Push notification fanout.
- Social draft generation and dispatch.
- Video thumbnail/transcoding/transcription.
- Live replay processing.
- Analytics rollups and scheduled leadership reports.

## Scaling Strategy

1. Keep one deployable Next.js app while the team is small.
2. Add `/api/v1` contracts and service helpers.
3. Add public cache headers and ISR-style page strategies.
4. Move expensive jobs to queue-backed workers.
5. Split only the modules with independent scaling pressure: media processing,
   search, notifications, and live/video processing.

## Security Strategy

- Keep route-handler permission checks as the source of truth.
- Keep admin APIs no-store and CSRF protected for mutations.
- Keep request IDs and audit logging on admin mutations.
- Validate all webhook signatures before accepting external events.
- Rate limit public forms, AI routes, auth setup routes, and tracking routes.
- Never expose provider secrets or raw stack traces in production API errors.

## Media Storage Strategy

- Store metadata in MongoDB.
- Store raw files, PDFs, page images, videos, and manual audio in
  DigitalOcean Spaces or another S3-compatible store.
- Keep Cloudinary URL support for legacy images and transformations.
- Use CDN URLs for public delivery.
- Store dimensions, MIME type, byte size, provider, and media key for every
  durable asset.

## Deployment Strategy

- Preserve the current Next.js standalone/Hostinger flow.
- Preserve Vercel compatibility where possible.
- Keep `scripts/validate-production-env.js`, smoke checks, rollback, and
  Hostinger preparation scripts.
- Add deployment smoke checks for API v1, health, public feed cache headers,
  admin login, e-paper PDF access, and upload readiness.

## 30-Day Roadmap

- Finish architecture docs and API utility foundation.
- Add response/error/validation helpers to new routes only.
- Add `/api/v1/public/home-feed`.
- Add MongoDB index review for public feed filters.
- Improve health output without breaking existing smoke checks.
- Add public cache tests for high-traffic endpoints.

## 90-Day Roadmap

- Move article/e-paper/video business logic from routes into service modules.
- Add API v1 response envelope for new mobile-ready routes.
- Add device token model and notification preference APIs.
- Add queue abstraction and first e-paper/AI worker jobs.
- Add admin shared components for workflow-heavy screens.

## 6-Month Roadmap

- Build Expo Android MVP on API v1.
- Add managed live streaming MVP.
- Add production search with Atlas Search or a dedicated search engine.
- Add ad slot/campaign models and revenue dashboards.
- Add analytics rollups and content performance reports.

## 12-Month Roadmap

- Scale media, search, notification, and analytics workers independently.
- Add iOS app if Android retention is proven.
- Add personalization and recommendation service.
- Add live replay archive and video monetization.
- Add advertiser reporting and self-serve capabilities where the business is
  ready.
