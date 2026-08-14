# Lokswami Digital Performance & SEO Remaining Phases Roadmap (3B – 9)

This document establishes the comprehensive implementation specifications, sub-section task breakdowns, acceptance criteria, and operational execution prompts for all remaining SEO and digital performance phases at Lokswami.

---

## Architecture & Phase Map

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Phase 0: Baseline & Read-Only Smoke Check [COMPLETE]                             │
│  Phase 1: GSC Indexing Audit & Canonical Dry Run [COMPLETE]                       │
│  Phase 2: Full Article SSR & Crawlable Related Links [COMPLETE]                   │
│  Phase 3A: URL Governance & Slug Lifecycle [COMPLETE]                             │
├──────────────────────────────────────────────────────────────────────────────────┤
│  Phase 3B: Schema.org Hardening & XML Sitemap Hardening [ACTIVE IMPLEMENTATION]   │
│  Phase 4: Core Web Vitals (CWV) Instrumentation & Real User Monitoring            │
│  Phase 5: Mobile Performance & Media Optimization Sprint                          │
│  Phase 6: Newsroom Analytics Data Quality & Engagement Tracking                  │
│  Phase 7: CMS Editorial SEO Guardrails & Publishing Checklist                     │
│  Phase 8: News-Led Discovery, Topic Clusters & Contextual Internal Linking        │
│  Phase 9: Production Governance, Automated Smoke Verification & Monthly Reporting │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 3B: Schema.org & XML Sitemap Hardening

### Objective
Provide comprehensive, valid Schema.org structured data (NewsArticle with Hindi metadata, BreadcrumbList, VideoObject, WebSite) and harden standard and Google News XML sitemaps to ensure zero invalid XML, zero non-200/draft leakage, and 100% canonical alignment.

### Task Breakdown
1. **NewsArticle JSON-LD Generator (`lib/seo/articleSeo.ts`)**:
   - Structured JSON-LD with `@type: "NewsArticle"`.
   - Include `headline`, `description`, `image`, `datePublished`, `dateModified`, `author` (Person/Organization), `publisher` (Lokswami metadata with logo), `inLanguage: "hi"`, `mainEntityOfPage`.
2. **BreadcrumbList JSON-LD Generator (`lib/seo/articleSeo.ts`)**:
   - Structured hierarchical breadcrumbs: Home (`/main`) -> Category (`/main/category/[category]`) -> Article Title.
3. **VideoObject JSON-LD Generator (`lib/seo/articleSeo.ts`)**:
   - For articles or stories containing video media: `name`, `description`, `thumbnailUrl`, `uploadDate`, `contentUrl`.
4. **WebSite & SearchAction Schema (`lib/seo/articleSeo.ts`)**:
   - Site search action schema linking to `/main/search?q={search_term_string}`.
5. **Google News Sitemap Hardening (`app/news-sitemap.xml/route.ts`)**:
   - Enforce RFC 3339 / ISO 8601 publication timestamps.
   - Filter published-only stories from past 48 hours.
   - Valid XML escaping and namespaces (`xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"`).
   - Safe empty fallback when no articles were published within 48 hours.
6. **Standard Sitemap Hardening (`app/sitemap.ts`)**:
   - Guarantee all entries are 200 OK canonical destinations.
   - Exclude drafts, scheduled, unlisted, and redirect aliases.
   - Parity across MongoDB and file store.

### Acceptance Criteria
- Valid Schema.org JSON-LD emitted in initial server HTML.
- Sitemaps contain only published canonical URLs with valid ISO timestamps.
- Zero XML parser syntax errors.
- Passing focused Vitest suite (`tests/seo-schema-and-sitemaps.test.ts`).

### Sub-agent / Codex Prompt
```text
Execute Phase 3B: Hardened Schema.org Structured Data and XML Sitemaps.
1. Implement buildNewsArticleJsonLd, buildBreadcrumbListJsonLd, buildVideoObjectJsonLd in lib/seo/articleSeo.ts.
2. Embed NewsArticle and BreadcrumbList JSON-LD in app/(reader)/main/article/[id]/layout.tsx.
3. Harden app/news-sitemap.xml/route.ts with published-only 48h filtering and valid Google News XML syntax.
4. Harden app/sitemap.ts to guarantee 200 OK canonical-only entries without aliases.
5. Create comprehensive tests in tests/seo-schema-and-sitemaps.test.ts and verify with npm run typecheck and vitest.
```

---

## Phase 4: Core Web Vitals (CWV) Instrumentation & RUM

### Objective
Instrument Real User Monitoring (RUM) for Core Web Vitals (LCP, INP, CLS, FCP, TTFB) with privacy-preserving telemetry to remediate the 106 "Poor" mobile URLs flagged in Search Console.

### Task Breakdown
1. **Client-Side Vitals Collector (`components/seo/WebVitalsBeacon.tsx`)**:
   - Lightweight `web-vitals` listener recording `LCP`, `INP`, `CLS`, `FCP`, `TTFB`.
   - Send beacons via `navigator.sendBeacon` or `fetch(..., { keepalive: true })`.
   - Rate limiting and sampling to prevent server flood.
2. **Telemetry Endpoint (`app/api/v1/public/analytics/vitals/route.ts`)**:
   - Validate payload format (metric name, value, rating, pathname, deviceType).
   - Privacy-safe: discard IP addresses, strip user identifiers, aggregate by template route (`/main/article/[slug]`, `/main/epaper`, `/main`).
3. **Core Web Vitals Threshold Evaluator (`lib/analytics/webVitals.ts`)**:
   - Classify values into `GOOD`, `NEEDS_IMPROVEMENT`, `POOR` per Google specifications:
     - LCP: <= 2.5s (Good), <= 4.0s (Needs Improvement), > 4.0s (Poor)
     - INP: <= 200ms (Good), <= 500ms (Needs Improvement), > 500ms (Poor)
     - CLS: <= 0.1 (Good), <= 0.25 (Needs Improvement), > 0.25 (Poor)

### Acceptance Criteria
- Web Vitals beacon triggers unobtrusively on client navigation and page load.
- Ingestion endpoint validates and aggregates metrics safely without recording PII.
- Comprehensive unit tests covering ingestion, boundary validation, and rating logic.

### Sub-agent / Codex Prompt
```text
Execute Phase 4: Core Web Vitals Instrumentation.
1. Create components/seo/WebVitalsBeacon.tsx for measuring LCP, INP, CLS, FCP, TTFB.
2. Create app/api/v1/public/analytics/vitals/route.ts to accept anonymized performance metrics.
3. Implement classification logic in lib/analytics/webVitals.ts.
4. Add tests in tests/web-vitals-instrumentation.test.ts.
```

---

## Phase 5: Mobile Performance Remediation Sprint

### Objective
Optimize mobile loading speed and interaction readiness across all reader templates (87% of audience is on mobile).

### Task Breakdown
1. **Critical CSS & Font Swap Optimization**:
   - Ensure Hindi font subsets (`Noto Sans Devanagari`, `Yatra One`, etc.) use `font-display: swap` to prevent FOIT (Flash of Invisible Text).
   - Eliminate render-blocking script tags and inline critical layout styles.
2. **Responsive Image Sizing & Priority Preloading**:
   - Ensure all article hero images have appropriate `sizes="(max-width: 768px) 100vw, 720px"` and `priority={true}` on primary story cards.
   - Standardize modern image formats (WebP, AVIF) with explicit `width` and `height` to prevent layout shifts (`CLS`).
3. **Interaction & Layout Shift Stability**:
   - Reserve explicit aspect ratio containers for ads, video players, and image carousels (`aspect-video`, `min-h-[220px]`).
   - Defer non-critical client component hydration until idle (`requestIdleCallback`).

### Acceptance Criteria
- Zero layout shifts caused by unsized hero artwork or ads.
- Hero images preloaded with high fetch priority on initial render.
- All test suites passing.

### Sub-agent / Codex Prompt
```text
Execute Phase 5: Mobile Performance Remediation.
1. Audit and optimize image loading across components/ui/HeroCard.tsx, app/(reader)/main/article/[id]/page.tsx, and related modules.
2. Add explicit dimension containers and priority image tags.
3. Optimize font loading definitions in app/layout.tsx.
4. Verify with focused tests and Lighthouse smoke validation.
```

---

## Phase 6: Analytics Quality & Deep Newsroom Engagement

### Objective
Correct acquisition traffic misclassifications (direct vs social vs organic) and track deep editorial KPIs (30s/60s engaged reading, scroll depth, audio listen completion).

### Task Breakdown
1. **Traffic Attribution Parser (`lib/analytics/trafficSource.ts`)**:
   - Correctly parse Referrer and UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`).
   - Prevent internal page navigations (`/main/epaper`, `/main/article/...`) from overriding the initial session acquisition source.
2. **Engagement Event Tracking**:
   - Ingest newsroom-specific reader milestones:
     - `article_read_30s`, `article_read_60s`
     - `scroll_depth_50`, `scroll_depth_90`
     - `tts_audio_play`, `tts_audio_completed`
     - `article_share_clicked`
3. **Privacy Governance**:
   - Strip client IPs and personal identifiers before storage.

### Acceptance Criteria
- Acquisition source preserved across intra-site navigation.
- Engaged reading and scroll events dispatched reliably.
- Unit tests verifying attribution parsing and event recording.

### Sub-agent / Codex Prompt
```text
Execute Phase 6: Analytics Quality and Newsroom Engagement.
1. Implement lib/analytics/trafficSource.ts with robust UTM and referrer classification.
2. Add client hooks for engaged time and scroll depth tracking in article reader views.
3. Update analytics ingestion pipeline in app/api/v1/public/analytics/events/route.ts.
4. Add comprehensive tests in tests/analytics-traffic-attribution.test.ts.
```

---

## Phase 7: CMS Editorial SEO Guardrails & Publishing Checklist

### Objective
Equip newsroom reporters and desk editors with real-time SEO validation, preventing un-optimized or conflicting articles from being published.

### Task Breakdown
1. **CMS Real-Time SEO Validator (`lib/seo/cmsSeoValidator.ts`)**:
   - Title length check (ideal: 40-70 characters in Hindi/English).
   - Meta description check (ideal: 120-160 characters).
   - Primary keyword density and presence in title, summary, and first paragraph.
   - OG image presence and dimensions.
2. **Pre-Publishing Modal / Checklist Component**:
   - Visual checklist showing SEO score, warnings, and missing fields before publishing.
   - Fast-track exemption for Breaking News editors.
3. **Canonical Override Protection**:
   - Prevent editors from entering conflicting external URLs or malformed paths as canonicals.

### Acceptance Criteria
- Editor displays real-time SEO health badge.
- Publish button prompts checklist review if critical SEO fields are missing (unless breaking news).
- Full test coverage for validator logic.

### Sub-agent / Codex Prompt
```text
Execute Phase 7: CMS Editorial SEO Guardrails.
1. Implement lib/seo/cmsSeoValidator.ts for score calculation and feedback.
2. Integrate SEO scoring and checklist in app/(admin)/admin/articles/new/ and edit views.
3. Add tests in tests/cms-seo-validator.test.ts.
```

---

## Phase 8: News-Led Discovery & Contextual Internal Linking

### Objective
Expand organic non-branded search footprint by developing topical news clusters (Indore/MP local news, Crime, Politics) and contextual internal link modules.

### Task Breakdown
1. **Contextual Related Articles Engine (`lib/server/publicArticles.ts`)**:
   - Prioritize same-category and same-tag stories with high semantic relevance.
   - Include breaking/trending stories in dedicated reader discovery rails.
2. **E-Paper to Web Cross-Pollination**:
   - Add "आज की प्रमुख डिजिटल खबरें" (Top Stories of Today) module on e-paper reader pages (`/main/epaper`).
3. **Topic & City Hub Pages**:
   - Optimize city landing pages (`/main/epaper?city=indore`, `/main/category/indore`) with crawlable navigation.

### Acceptance Criteria
- Related links are 100% crawlable, published-only, and deduplicated.
- E-paper reader links directly back to authoritative digital articles.
- Parity between MongoDB and file-store implementations.

### Sub-agent / Codex Prompt
```text
Execute Phase 8: News-Led Discovery and Internal Linking.
1. Enhance listRelatedPublicArticles in lib/server/publicArticles.ts to support tag matching.
2. Add cross-link discovery module to e-paper pages.
3. Add tests in tests/news-discovery-internal-links.test.ts.
```

---

## Phase 9: Production Governance & Automated Monthly Reporting

### Objective
Establish automated ongoing governance, continuous smoke validation, and monthly Search Console / Analytics reconciliation reports.

### Task Breakdown
1. **Automated SEO Health Scanner (`scripts/seo-health-audit.js`)**:
   - Validates live sitemaps, canonicals, robots.txt, Core Web Vitals beacon health, and article SSR.
2. **Monthly Management Report Generator (`scripts/generate-monthly-seo-report.js`)**:
   - Generates executive markdown/JSON report comparing Month-over-Month clicks, impressions, CTR, indexed URL counts, and CWV compliance.
3. **CI/CD Quality Gate**:
   - Ensure all SEO smoke checks run automatically in GitHub Actions.

### Acceptance Criteria
- Automated audit script runs in under 30 seconds against staging/production.
- Generates reproducible monthly executive summary.

### Sub-agent / Codex Prompt
```text
Execute Phase 9: Production Governance and Monthly Reporting.
1. Create scripts/seo-health-audit.js for comprehensive automated inspection.
2. Create scripts/generate-monthly-seo-report.js.
3. Add test coverage in tests/seo-health-audit.test.ts.
```
