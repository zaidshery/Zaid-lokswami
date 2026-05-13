# Media, Live, Mobile, AI Roadmap

Last reviewed: 2026-05-09

## Mobile App Roadmap

Use Expo React Native with TypeScript.

Phase 1:

- Consume `/api/v1/public/articles/latest`, videos, shorts, e-paper, and
  breaking feeds.
- Build home feed, article detail, category feed, video list, shorts list, and
  e-paper list.
- Add basic saved articles with local storage first.

Phase 2:

- Add login/session support.
- Add `/api/v1/app/feed`, `/device-tokens`, `/saved-articles`, and
  `/preferences`.
- Add offline reading cache for recent articles and e-paper metadata.

Phase 3:

- Add live stream viewer.
- Add push notification preferences.
- Add richer e-paper reader with thumbnails and PDF/page viewing.

Rule: do not build a WebView-only app as the long-term product.

## Live Streaming Roadmap

Stage 1: YouTube Live MVP

- Add `live_streams` model.
- Admin creates title, slug, scheduled time, YouTube embed ID, status, and
  sponsor metadata.
- Public `/api/v1/public/live/current` returns current stream.
- Website and app display embed.
- Admin can mark live started/ended.

Stage 2: Owned managed provider

- Evaluate Mux or Cloudflare Stream.
- Store provider stream key, playback URL, asset ID, status, and webhooks.
- Add replay archive that can become a video article.

Stage 3: Low-latency interactive live

- Evaluate AWS IVS if elections/events need lower latency.
- Add live blog timeline, pinned updates, push alerts, and analytics.

## Push Notification Roadmap

Transport options:

- Firebase Cloud Messaging.
- OneSignal.

Required modules:

- `device_tokens` collection.
- Notification preferences by city, category, language, breaking, e-paper, and
  live.
- Admin notification composer.
- Worker job for send fanout.
- Delivery log and failure metrics.

Notification types:

- Breaking news.
- City-specific news.
- New e-paper available.
- Live stream starting.
- Election result update.
- Daily digest.
- Important video published.

## AI Roadmap

Current repo uses local retrieval, extractive summaries, manual audio uploads,
and optional custom/local OCR. Paid external AI APIs are intentionally disabled.

Next features:

- Local article summary worker.
- Manual SEO checklist helpers.
- Headline checklist helpers.
- Hindi grammar/correction workflow using editor review.
- Local search assistant improvements.
- Related article recommendations.
- E-paper OCR cleanup.
- Video/story transcript summaries.

TTS direction:

- Article listen audio should use manual upload for editorial control.
- E-paper story audio can keep manual asset priority.
- Paid AI TTS generation is disabled; publish audio through manual uploads.

Editorial rule:

- AI assists editors.
- AI should not auto-publish sensitive news without review.

## Worker And Queue Roadmap

Create a `workers/` folder only after queue interfaces are designed.

Initial events:

```text
epaper.uploaded
article.published
live.started
video.uploaded
notification.send
search.index
ai.summary.generate
social.draft.create
```

Initial workers:

- `epaper.worker.ts`: PDF pages, OCR, thumbnails, article hotspots.
- `ai.worker.ts`: local summaries, local search index refresh, editorial checklists.
- `notification.worker.ts`: push fanout and delivery logging.
- `media.worker.ts`: thumbnails, video metadata, transcript jobs.
- `social.worker.ts`: social draft creation and dispatch tracking.

Job principles:

- Request handlers create records and enqueue jobs.
- Workers update status fields and activity logs.
- Jobs must be idempotent.
- External provider failures should retry with backoff.
- Admin UI should show job status and last error.

## Media Storage Roadmap

Current state:

- DigitalOcean Spaces helpers exist for direct uploads and public URLs.
- Cloudinary URL compatibility exists for older image assets.
- E-paper assets, story videos, and article audio already use storage helpers.

Next steps:

- Create a common media asset service for metadata.
- Track provider, key, URL, width, height, byte size, MIME type, duration, and
  usage.
- Add cleanup jobs for orphaned assets.
- Keep large media uploads direct-to-storage.
