# Hostinger And Cloudflare Scaling Phases

Last reviewed: 2026-05-29

This plan keeps Hostinger as the Node.js application host, keeps production
media outside Hostinger, and makes public traffic cache-first before adding
heavier worker infrastructure.

## Phase 1 - Public Cache First

Status: code implemented.

- Public reader pages now send shared cache headers for home, latest, article,
  category, e-paper, videos, stories, and search surfaces.
- Public JSON feed TTLs are stronger for home feed, article lists, article
  detail, e-paper feeds, video feeds, shorts, and stories.
- Private reader pages remain no-store: account, saved, and preferences.
- Breaking news stays intentionally short-cache because freshness matters more.

Expected impact:

- With Cloudflare enabled, repeat public reads should be served from CDN/shared
  cache instead of repeatedly hitting Next.js and MongoDB.
- Real improvement depends on cache hit ratio. A 70-90% public cache hit ratio
  can remove most public read pressure from Hostinger.

## Phase 2 - CDN/WAF In Front

Status: code ready, dashboard action required.

Recommended Cloudflare rules:

- Cache HTML and JSON for public paths when the app sends public
  `Cache-Control`.
- Bypass cache for `/admin/*`, `/api/admin/*`, `/api/auth/*`,
  `/main/account/*`, `/main/saved/*`, and `/main/preferences/*`.
- Keep WAF and bot protection on for `/api/*`.
- Keep DigitalOcean Spaces/CDN domains as media origins; do not proxy uploads
  through Hostinger.

Deployment note:

- This phase cannot be fully completed from the repository because DNS,
  Cloudflare cache rules, and WAF rules live in Cloudflare/Hostinger dashboards.

## Phase 3 - Mongo Query Protection

Status: code implemented.

Indexes added or reinforced:

- Articles: slug, previous slugs, category timeline, breaking timeline,
  trending timeline, reporter location timeline, and admin updated timeline.
- Stories: published priority timeline, category timeline, and admin updated
  timeline.
- Videos: published short/video timelines, category timeline, and admin updated
  timeline.
- E-papers: public status/city/date timeline and updated timeline.
- E-paper articles: page order by edition and creation time.

Operational note:

- New MongoDB indexes build on first deployment/startup when Mongoose syncs
  them. Watch MongoDB Atlas metrics during the first production boot after
  deploying.

## Phase 4 - Rate Limits For Expensive Routes

Status: code implemented.

- Public API routes now have a general middleware limit.
- Admin pages and admin APIs have a per-user/IP middleware limit.
- Expensive routes have a stricter limiter, including OCR Assist, e-paper page
  generation, public search, local AI summaries/search, breaking audio, social
  draft generation, and analytics report runs.
- Large multipart upload routes still bypass middleware early so request body
  streams are not disturbed.

Follow-up:

- If uploads become abused, add route-level checks inside the upload handlers
  before reading large bodies, or move uploads to pre-signed direct-to-storage
  flows only.

## Phase 5 - Media Outside Hostinger

Status: architecture retained.

- Keep images, PDFs, videos, audio, and e-paper page assets in DigitalOcean
  Spaces/CDN.
- Hostinger disk should hold the app release only, not production media.
- Run the Spaces smoke test before launch when upload features are enabled.

## Phase 6 - Workers For Heavy Jobs

Status: guarded and documented; full worker migration remains a later deploy
topology change.

Heavy work that should move behind a queue as volume grows:

- OCR and OCR image preprocessing.
- PDF-to-image generation.
- AI summary/search indexing.
- Analytics rollups and leadership report generation.
- Video processing and social publishing fanout.

Current protection:

- The heaviest routes are rate-limited and OCR preprocessing is bounded.
- Load testing can now show which routes need to be pulled into a worker first.

Future implementation shape:

- Add a durable job collection or queue service.
- Change heavy request routes to create a job and return `{ status, jobId }`.
- Run a separate worker process on VPS/worker hosting.
- Keep the public/admin web process focused on fast request-response work.

## Phase 7 - Load Test Gate

Status: code implemented.

Run against local, staging, or production:

```bash
npm run load:test:public -- --baseUrl=https://lokswami.com --durationSec=30 --concurrency=50
```

Default routes:

- `/`
- `/main`
- `/main/latest`
- `/main/epaper`
- `/api/v1/public/home-feed`
- `/api/v1/public/articles?limit=10`
- `/api/v1/public/epapers?limit=10`
- `/api/videos/latest?limit=6`
- `/api/stories/latest?limit=6`
- `/api/v1/public/search?q=indore&limit=10`

Launch rule:

- Increase concurrency gradually: 25, 50, 100, 200.
- Watch p95 latency, error rate, MongoDB CPU, Hostinger CPU, and memory.
- Do not estimate maximum users from server specs alone. Use measured RPS and
  cache hit ratio.

## Capacity Guidance

Without Cloudflare cache, the app capacity is limited by dynamic Next.js
requests plus MongoDB query cost. With Cloudflare cache and the code changes in
this phase, public read traffic can scale much higher because most repeat reads
should not reach Hostinger.

Use this rough planning model:

- Public cached read: usually served by CDN, minimal Hostinger impact.
- Public uncached read: hits Next.js and may hit MongoDB.
- Admin/editor action: dynamic and should be counted against Hostinger.
- OCR/PDF/AI job: expensive; keep low concurrency until workers are added.

For a news launch, judge readiness by measured values:

- p95 public cached/API latency under 500-800 ms.
- Error rate under 2% during load test.
- MongoDB CPU stable under sustained test.
- Hostinger memory not climbing continuously.
- OCR/PDF/admin actions still responsive during public traffic.
