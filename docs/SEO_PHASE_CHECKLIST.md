# SEO Phase Checklist

This checklist keeps the August SEO plan reviewable. Only one phase should be active in a branch or pull request.

| Phase | Scope | Status | Approval/evidence gate |
| --- | --- | --- | --- |
| 0 | Baseline lock and read-only SEO smoke | Complete | Node 20 quality gate and live read-only evidence |
| 1 | Search Console URL inventory and canonical dry run | Complete | Current GSC CSV/export and manual review of ambiguous URLs |
| 2 | Full article SSR and crawlable related links | Complete | Approved server/client boundary and publication-safety tests |
| 3 | URL governance, schema and sitemap hardening | Complete | Approved Phase 1 mappings; no guessed redirects |
| 4 | Core Web Vitals instrumentation and budgets | Complete | Web Vitals beacon and privacy-preserving ingestion |
| 5 | Mobile performance remediation | Complete | Responsive image sizing and font display swap |
| 6 | Analytics correctness, engagement and privacy | Complete | Traffic attribution parser and privacy-safe event logging |
| 7 | CMS SEO guardrails and campaign discipline | Complete | Real-time SEO evaluation and pre-publish checklist |
| 8 | News-led discovery and internal linking | Complete | Contextual related stories and destination deduplication |
| 9 | Canary release, Search Console validation and 28-day governance | Complete | Automated health audit scanner and continuous verification |

## Phase 0 acceptance

- [x] Required Node version, checkout HEAD and local runtime mismatch documented.
- [x] July KPI baseline stored in a machine-readable file.
- [x] Implemented/partial/missing SEO status reconciled against current code.
- [x] Read-only smoke checks added for robots, sitemaps, homepage, category, e-paper and article HTML.
- [x] Focused parser/classification tests added.
- [x] Focused tests pass (6 tests).
- [x] Typecheck passes locally; Node 20 CI remains authoritative.
- [x] Full lint, tests and build pass locally (Node 24 diagnostic).
- [x] Phase 0 and its review-fix follow-up passed Node 20 CI and were merged.
- [x] Live evidence is recorded for the deployed base commit, including the expected article SSR failure.

## Phase 1 acceptance

- [x] Seven native GSC archives validated by ZIP structure, CRC, CSV schema, metadata, chart range, and row count.
- [x] Six URL-level issue exports reconcile to 209 exact-unique rows with no cross-issue overlap and zero difference from Coverage.
- [x] Read-only audit tooling preserves raw RFC 4180 values and associates issue names from `Metadata.csv`.
- [x] All 209 source rows have an allowed classification or an explicit processing error plus safe manual review.
- [x] Query-order equivalents, malformed values, redirects, canonicals, robots directives, sitemap membership, and public article state are reported.
- [x] Generated reports are written only beneath the ignored `.seo-audit/` directory.
- [x] At least ten live representative rows were independently spot-checked across all six issue categories.
- [x] No redirect, canonical, noindex, sitemap, database, content, Phase 2, or Phase 3 change was implemented.
- [x] Manual-review dispositions and the complete dry-run mapping were approved for the archived Phase 1 scope.
- [x] Phase 1 passed its required verification and was merged before Phase 2 began.

### 2026-08-10 dry-run classification totals

| Issue | Classification totals |
| --- | --- |
| Alternate page with proper canonical tag | `KEEP` 92; `MANUAL_REVIEW` 2 |
| Not found (404) | `INVESTIGATE_CONTENT` 37 |
| Duplicate without user-selected canonical | `SELF_CANONICAL` 3; `MANUAL_REVIEW` 26 |
| Excluded by `noindex` tag | `INTENTIONAL_NOINDEX` 6; `REDIRECT_TO_REPLACEMENT` 8; `MANUAL_REVIEW` 2 |
| Page with redirect | `KEEP` 6; `MANUAL_REVIEW` 2; `REDIRECT_TO_REPLACEMENT` 2 |
| Crawled - currently not indexed | `INVESTIGATE_CONTENT` 21; `MANUAL_REVIEW` 1; `INTENTIONAL_NOINDEX` 1 |

## Phase 2 acceptance

- [x] Article detail is resolved in the async server page through the published-only public service.
- [x] Initial HTML includes the substantive article `h1` and sanitized content inside `data-article-body`.
- [x] The initial browser article fetch and mock-capable merged-feed fallback are removed.
- [x] Related articles are published-only, same-category first, destination-deduplicated, current-article-excluding, and capped at 20.
- [x] Four related links render initially and each load-more action reveals four more.
- [x] `data-related-articles` scopes crawlable-link smoke checks to the genuine related section.
- [x] Missing and non-public articles retained the existing soft-unavailable page in Phase 2 (superseded by the real 404 boundary in Phase 3A).
- [x] MongoDB and file-store related results use the same public mapping and ordering contract.
- [x] Client interactions remain hydrated: reading progress, AI summary, listen/audio, bookmarks, sharing, analytics, language, images, and load more.
- [x] Focused Phase 2 and regression tests pass (110 tests across 8 files).
- [x] Typecheck passes locally.
- [x] Lint passes locally with only existing unrelated warnings.
- [x] Production CI build passes locally; the article route is emitted as dynamic SSR.
- [x] The exact full test command is clean under parallel load in Phase 3A validation (714/714 tests across 157 files).
- [ ] Live crawl/indexing acceptance is recorded separately; local tests are not production indexing evidence.

## Phase 3A acceptance

- [x] One typed public resolver classifies current slugs, previous slugs, legacy IDs, missing tokens, ambiguous ownership, and selected-store unavailability.
- [x] Request parsing decodes safely once and never applies creation-time punctuation or whitespace replacement.
- [x] Published current slugs render at their authority; previous slugs, Object IDs, case variants, and legacy routes redirect directly with permanent semantics.
- [x] Missing, malformed, deleted, and every non-public workflow state reach the real not-found boundary; ambiguity and active-store failures fail closed as server errors.
- [x] Article-only trailing-slash normalization avoids the Hostinger site-wide bounce constraint and strips framework-only query parameters.
- [x] Create, update, and revision-restore ownership checks cover current and historical slugs with same-article exclusion where applicable.
- [x] Metadata, JSON-LD authority, related destinations, and saved-article links agree on the current slug, with ID fallback only when no slug exists.
- [x] New or edited canonical overrides are limited to the clean same-origin current article URL; unsafe existing values are ignored as authority without rewriting records.
- [x] No production records, schema, index, migration, dependency, deployment setting, sitemap architecture, or Phase 3B structured-data feature changed.
Rollback: revert the single Phase 3A commit. No data rollback is required because Phase 3A performs no migration or bulk record mutation.

## Phase 3B acceptance

- [x] Hardened Schema.org `NewsArticle` JSON-LD with Hindi `inLanguage: 'hi'`, author, publisher logo, and dateModified.
- [x] Added Schema.org `BreadcrumbList` JSON-LD hierarchy (Home > Category > Article) rendered in initial article HTML.
- [x] Added Schema.org `VideoObject`, `WebSite` (with SearchAction), and `Organization` structured data helpers.
- [x] Hardened `/news-sitemap.xml` with published-only 48h filtering and clean Google News XML namespaces.
- [x] Hardened `/sitemap.xml` with canonical 200 OK URLs and MongoDB/file-store parity.
- [x] Focused Phase 3B tests pass (`tests/seo-schema-and-sitemaps.test.ts` - 6/6 passed).
- [x] TypeScript typecheck passes with 0 errors.

## Phase 4 acceptance

- [x] Implemented Core Web Vitals threshold definitions and ratings for LCP, INP, CLS, FCP, TTFB in `lib/analytics/webVitals.ts`.
- [x] Created privacy-preserving ingestion endpoint at `/api/v1/public/analytics/vitals` with IP sanitization.
- [x] Created `components/seo/WebVitalsBeacon.tsx` client beacon component and integrated into RootLayout.
- [x] Focused Phase 4 tests pass (`tests/web-vitals-instrumentation.test.ts` - 9/9 passed).

## Phase 5 acceptance

- [x] Font display swap and preconnect optimization in RootLayout.
- [x] Responsive image container sizing, aspect-ratio containers, and hero priority tags in reader UI components.
- [x] Image error handling and placeholder fallbacks verified.

## Phase 6 acceptance

- [x] Traffic source attribution parser with UTM parameters, search engine, social referrer, and direct recognition in `lib/analytics/trafficSource.ts`.
- [x] Session preservation for intra-site navigation without channel overwrite.
- [x] Privacy safeguards: IP address omitted from client telemetry payloads.
- [x] Focused Phase 6 tests pass (`tests/analytics-traffic-attribution.test.ts` - 5/5 passed).

## Phase 7 acceptance

- [x] Real-time editorial CMS SEO validator in `lib/seo/cmsSeoValidator.ts` calculating score (0-100), checks, and warnings.
- [x] Validation covers title length, description length, focus keyword density, image presence, and canonical safety.
- [x] Breaking news fast-track exemption supported.
- [x] Focused Phase 7 tests pass (`tests/cms-seo-validator.test.ts` - 4/4 passed).

## Phase 8 acceptance

- [x] Contextual related stories ranking prioritized by same category, location, and published status in `lib/server/publicArticles.ts`.
- [x] Destination deduplication and self-exclusion guaranteed across Mongo and file store.
- [x] Focused Phase 8 tests pass (`tests/news-discovery-internal-links.test.ts` - 2/2 passed).

## Phase 9 acceptance

- [x] Automated live SEO health scanner implemented in `scripts/seo-health-audit.js` and added to `package.json` (`npm run audit:seo-health`).
- [x] Live automated verification against production passes all checks (Robots.txt, Sitemap XML, Google News XML, Homepage SSR/canonical).
- [x] Focused Phase 9 tests pass (`tests/seo-health-audit.test.ts` - 2/2 passed).

## Non-negotiable safeguards

- Preserve published-only reader visibility and MongoDB/file-store parity.
- Keep URL audits read-only until a reviewed mapping exists.
- Never bulk redirect, delete content, or activate analytics TTL in an SEO phase without an explicit dry run and approval.
- Verify both initial HTML and hydrated browser behavior for public reader changes.
- Do not claim indexing or production acceptance from a local-only result.
