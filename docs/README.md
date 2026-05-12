# Lokswami Architecture Docs

This folder documents the practical path from the current Next.js newsroom app
to a modern API-first media platform.

## Suggested Reading Order

1. [Lokswami Platform 2 Architecture](./LOKSWAMI_PLATFORM_2_ARCHITECTURE.md)
   - Start here for the full system shape, current architecture summary,
     scaling strategy, and roadmap.

2. [API v1 Roadmap](./API_V1_ROADMAP.md)
   - Read this before adding new public, mobile, admin, AI, webhook, or app
     routes.

3. [Platform 2 Phased Execution Plan](./PLATFORM_2_PHASED_EXECUTION_PLAN.md)
   - Use this as the step-by-step tracker for what is done, what is in
     progress, and what comes next.

4. [Performance And Scaling Plan](./PERFORMANCE_AND_SCALING_PLAN.md)
   - Use this before changing public feeds, article pages, e-paper pages,
     caching, images, video, service worker behavior, or deployment checks.

5. [Media, Live, Mobile, AI Roadmap](./MEDIA_LIVE_MOBILE_AI_ROADMAP.md)
   - Use this for Expo app planning, live streaming, push notifications, AI
     features, and worker/queue design.

6. [Newsroom CMS 2 Plan](./NEWSROOM_CMS_2_PLAN.md)
   - Use this before expanding admin workflow, review queues, roles, shared CMS
     components, audit logs, or newsroom dashboards.

## Existing Architecture Records

- [ADR 001: Keep The Next.js + MongoDB Monolith](./architecture/adr-001-keep-nextjs-mongodb-monolith.md)
- [ADR 002: MongoDB-backed TTS Queue](./architecture/adr-002-mongodb-backed-tts-queue.md)
- [ADR 003: Security Audit Design](./architecture/adr-003-security-audit-design.md)
- [ADR 004: API-First Modular Media Platform](./architecture/adr-004-api-first-modular-media-platform.md)

## Implementation Rule

Do not rebuild Lokswami from zero. Add stable boundaries, v1 APIs, service
modules, cache strategy, and workers in phases while keeping the current reader,
admin, e-paper, AI, auth, storage, and deployment flows working.
