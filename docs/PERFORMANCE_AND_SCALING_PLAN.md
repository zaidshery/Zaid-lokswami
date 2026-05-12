# Performance And Scaling Plan

Last reviewed: 2026-05-09

## Targets

- LCP under 2.5 seconds.
- INP under 200 ms.
- CLS under 0.1.
- Public API response under 300-700 ms where possible.
- Homepage TTFB under 800 ms where possible.
- Article pages should be highly cacheable.
- Admin pages should be secure and reliable before being aggressively fast.

## Current Performance Risks

- Some public pages still fetch API routes from the same app instead of calling
  shared services directly.
- Many routes build their own response/error shapes, which makes cache and
  error behavior inconsistent.
- E-paper conversion, OCR, AI, video, search indexing, and notification fanout
  can become too heavy for normal request handlers.
- Public analytics tracking can grow quickly without rollups or retention.
- Legacy Cloudinary URLs can fail if source assets are deleted or transformed
  URLs point to missing resources.
- Client-heavy reader components can increase JavaScript cost if more features
  are added without server/component boundaries.

## Homepage Caching Strategy

- Cache public feed sections for 30-120 seconds.
- Keep breaking news at a shorter 10-30 second shared cache.
- Load user-specific state, saved status, popups, and preferences separately.
- Use `/api/v1/public/home-feed` for compact grouped sections when building new
  reader/mobile homepage clients.

## Article Page Caching Strategy

- Public article detail can use a shared 120 second cache with stale revalidate.
- Use static metadata and schema generation where possible.
- Lazy load comments, related articles, ads, AI tools, and share helpers.
- Preload only the hero image.

## Category Page Caching Strategy

- Cache category feeds for 1-5 minutes depending on traffic.
- Use cursor pagination and indexed `category + publishedAt` queries.
- Do not fetch all articles and filter in memory for large categories.

## E-paper Caching Strategy

- Cache e-paper list APIs for 5-10 minutes.
- Cache public e-paper detail and page metadata separately from signed/raw PDF
  access.
- Deliver PDF and page images through CDN-backed storage.
- Keep admin e-paper status and upload routes no-store.

## Breaking News Caching Strategy

- Cache breaking feed for 10-30 seconds.
- Keep manual breaking audio metadata in the article/breaking response only when
  ready.
- Provide an admin publish action that can later trigger cache invalidation or a
  worker event.

## Admin API No-cache Strategy

- Admin routes must use no-store headers.
- Admin pages should not cache permission-sensitive payloads publicly.
- Mutations should set request ID and audit metadata.
- Admin dashboards can use short private caches only if the data is not
  permission-sensitive.

## CDN Strategy

- Keep immutable cache for Next.js static assets.
- Keep public media behind DigitalOcean Spaces CDN or a future CDN layer.
- Use cache headers on public JSON feeds.
- Keep service worker caching conservative so stale news does not persist too
  long.

## Image Optimization Strategy

- Store width, height, MIME type, and provider key for new uploads.
- Use WebP/AVIF where the image provider supports it.
- Use `next/image` for fixed known dimensions.
- Avoid remote placeholder/demo images in production feeds.
- Keep Cloudinary transform helper for legacy URLs.

## Video Optimization Strategy

- Do not serve large video files through the Next.js server.
- Store raw upload metadata in Spaces, then later process through managed video
  provider.
- Generate thumbnails separately.
- Add duration, poster, transcript, provider asset ID, and processing status.
- Use adaptive HLS playback for owned video/live modules.

## MongoDB Indexing Strategy

Already present:

- Articles: published timeline, workflow queues, author/assignee queues.
- E-papers: city/date unique, public status/date, production status.
- Videos/stories: published timelines and workflow queues.
- Analytics events: event/date and created date.
- Audit/content activity/TTS assets: operational indexes.

Recommended additions after query review:

- `articles.slug` unique/sparse once slug migration is clean.
- `articles.category + publishedAt`.
- `articles.isBreaking + publishedAt`.
- `videos.isPublished + isShort + publishedAt/createdAt`.
- `stories.isPublished + priority + publishedAt`.
- `analytics_events.createdAt` retention or rollup plan.

## Database Query Rules

- Always query by status plus date/order for public feeds.
- Always use `limit`.
- Use projection/select for public APIs.
- Use cursor pagination, not deep skip, for feeds.
- Avoid loading embeddings unless needed.
- Avoid filtering large collections in JavaScript after DB fetch.

## API Response Targets

- Cached public feed hit: under 100 ms at CDN/edge/proxy where possible.
- Uncached public feed: 300-700 ms.
- Admin list APIs: under 700 ms for normal page sizes.
- Upload init/complete APIs: under 1 second, excluding direct-to-storage upload.
- Heavy AI/media jobs: return job/status quickly.

## Service Worker And PWA Warnings

- Do not cache admin pages or admin API responses.
- Do not cache personalized account/saved/preference pages publicly.
- Keep news feed cache TTLs short.
- Provide cache busting for article updates and major corrections.
- Test offline behavior so old breaking news does not look current.

## Deployment Smoke Test Recommendations

- `GET /api/health` returns current legacy health shape.
- `GET /api/v1/public/health` works.
- Public latest article, video, shorts, stories, e-paper, and breaking routes
  return expected cache headers.
- Admin login page renders.
- Admin session-protected route rejects unauthenticated access.
- E-paper PDF proxy works for a published edition.
- Upload diagnostics confirm DigitalOcean Spaces readiness.
- Public article page renders metadata and image.
- Sitemap and robots routes respond.

## Scaling Sequence

1. Public cache headers and ISR-style fetches.
2. Service-layer extraction for feed/query logic.
3. Worker queue for e-paper and AI.
4. Search engine/indexing job.
5. Notification worker.
6. Managed live/video provider.
7. Separate worker deployment if job volume requires it.
