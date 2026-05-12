# Lokswami API v1

API v1 is the stable entrypoint for public clients such as the reader website,
native mobile app, automation previews, and future partner tools.

The first v1 routes started as compatibility wrappers over existing production
routes. New foundation routes should use the standard response envelope so web
and mobile clients can share predictable contracts.

## Public Content Routes

| Route | Purpose | Cache policy |
| --- | --- | --- |
| `GET /api/v1/public/home-feed` | Grouped reader/mobile home feed | `s-maxage=60, stale-while-revalidate=300` |
| `GET /api/v1/public/articles` | Published article feed with category, city, and cursor filters | `s-maxage=60, stale-while-revalidate=300` |
| `GET /api/v1/public/articles/latest` | Latest published article feed with cursor pagination | `s-maxage=60, stale-while-revalidate=300` |
| `GET /api/v1/public/articles/[slug]` | Public article detail by slug or ID | `s-maxage=120, stale-while-revalidate=600` |
| `GET /api/v1/public/categories` | Public category list for navigation and filters | `s-maxage=3600, stale-while-revalidate=86400` |
| `GET /api/v1/public/cities` | Public city list for e-paper and local filters | `s-maxage=3600, stale-while-revalidate=86400` |
| `GET /api/v1/public/health` | Compatibility health check for smoke tests | Dynamic/no public cache |
| `GET /api/v1/public/stories/latest` | Visual stories rail | `s-maxage=60, stale-while-revalidate=300` |
| `GET /api/v1/public/videos` | Public video feed alias for latest videos | `s-maxage=60, stale-while-revalidate=300` |
| `GET /api/v1/public/videos/latest` | Video feed with cursor pagination | `s-maxage=60, stale-while-revalidate=300` |
| `GET /api/v1/public/shorts` | Public shorts feed alias for latest shorts | `s-maxage=60, stale-while-revalidate=300` |
| `GET /api/v1/public/shorts/latest` | Shorts feed with cursor pagination | `s-maxage=60, stale-while-revalidate=300` |
| `GET /api/v1/public/epapers` | Published e-paper list with page/city/date filters | `s-maxage=300, stale-while-revalidate=600` |
| `GET /api/v1/public/epapers/latest` | Published e-paper list with filters and cursor pagination | `s-maxage=300, stale-while-revalidate=600` |
| `GET /api/v1/public/breaking` | Breaking ticker items | `s-maxage=20, stale-while-revalidate=120` |
| `GET /api/v1/public/search` | Public article search with category/city filters | `s-maxage=60, stale-while-revalidate=300` |

## Legacy Route Mapping

| v1 route | Current route |
| --- | --- |
| `/api/v1/public/home-feed` | New service-layer route |
| `/api/v1/public/articles` | New service-layer route |
| `/api/v1/public/articles/latest` | `/api/articles/latest` |
| `/api/v1/public/articles/[slug]` | New service-layer route with `/api/articles/[id]` as reader fallback |
| `/api/v1/public/categories` | New static/service-layer route |
| `/api/v1/public/cities` | New static/service-layer route |
| `/api/v1/public/health` | `/api/health` |
| `/api/v1/public/stories/latest` | `/api/stories/latest` |
| `/api/v1/public/videos` | `/api/videos/latest` |
| `/api/v1/public/videos/latest` | `/api/videos/latest` |
| `/api/v1/public/shorts` | `/api/shorts/latest` |
| `/api/v1/public/shorts/latest` | `/api/shorts/latest` |
| `/api/v1/public/epapers` | `/api/epapers` |
| `/api/v1/public/epapers/latest` | `/api/epapers/latest` |
| `/api/v1/public/breaking` | `/api/breaking` |
| `/api/v1/public/search` | New service-layer article search route |

## Response Envelope Target

Current public routes may return legacy shapes like:

```json
{
  "items": [],
  "limit": 20,
  "hasMore": false,
  "nextCursor": null
}
```

New service-layer v1 routes use:

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "error": null
}
```

For existing routes, migrate response shapes only with a planned client update.

## Client Rules

- Public feed clients should use v1 routes for new work.
- Admin, upload, auth, and user-personal routes must not be cached publicly.
- Heavy AI/media work should return a job/status response instead of doing the
  whole task in the request.
- Mobile app code should not depend on reader page internals.
