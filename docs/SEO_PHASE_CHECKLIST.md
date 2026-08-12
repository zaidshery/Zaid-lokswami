# SEO Phase Checklist

This checklist keeps the August SEO plan reviewable. Only one phase should be active in a branch or pull request.

| Phase | Scope | Status | Approval/evidence gate |
| --- | --- | --- | --- |
| 0 | Baseline lock and read-only SEO smoke | Complete | Node 20 quality gate and live read-only evidence |
| 1 | Search Console URL inventory and canonical dry run | Complete | Current GSC CSV/export and manual review of ambiguous URLs |
| 2 | Full article SSR and crawlable related links | Implemented locally | Approved server/client boundary and publication-safety tests |
| 3 | URL governance, schema and sitemap hardening | Pending | Approved Phase 1 mappings; no guessed redirects |
| 4 | Core Web Vitals instrumentation and budgets | Pending | Event/privacy design and 48-hour field baseline |
| 5 | Mobile performance remediation | Pending | Phase 4 evidence identifies the worst template |
| 6 | Analytics correctness, engagement and privacy | Pending | Retention/IP decision; no TTL or deletion without approval |
| 7 | CMS SEO guardrails and campaign discipline | Pending | Editor-approved blockers, warnings and breaking-news exception |
| 8 | News-led discovery and internal linking | Pending | Relevance fixtures and hub-indexing threshold |
| 9 | Canary release, Search Console validation and 28-day governance | Pending | Node 20 CI, staging/canary proof and named rollback owner |

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
- [x] Missing and non-public articles retain the existing soft-unavailable page and noindex behavior.
- [x] MongoDB and file-store related results use the same public mapping and ordering contract.
- [x] Client interactions remain hydrated: reading progress, AI summary, listen/audio, bookmarks, sharing, analytics, language, images, and load more.
- [x] Focused Phase 2 and regression tests pass (110 tests across 8 files).
- [x] Typecheck passes locally.
- [x] Lint passes locally with only existing unrelated warnings.
- [x] Production CI build passes locally; the article route is emitted as dynamic SSR.
- [ ] The exact full test command is clean under parallel load (675/676 pass; the one unrelated recovery test passes in isolation but exceeds its five-second timeout in the full run).
- [ ] Live crawl/indexing acceptance is recorded separately; local tests are not production indexing evidence.

## Non-negotiable safeguards

- Preserve published-only reader visibility and MongoDB/file-store parity.
- Keep URL audits read-only until a reviewed mapping exists.
- Never bulk redirect, delete content, or activate analytics TTL in an SEO phase without an explicit dry run and approval.
- Verify both initial HTML and hydrated browser behavior for public reader changes.
- Do not claim indexing or production acceptance from a local-only result.
