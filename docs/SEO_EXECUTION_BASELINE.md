# SEO Execution Baseline - 10 August 2026

## Decision

This file is the Phase 0 evidence lock. It does not change public rendering, routing, indexing, redirects, database content, or analytics retention. Phase 1 remains a read-only Search Console inventory. The first planned production rendering change is Phase 2 article SSR.

## Repository snapshot

- Repository HEAD when Phase 0 started: `4c4a0a56c8e5dcdd75d17dcc4124a8cc6f5ed042`.
- Phase branch: `seo/phase-00-baseline`.
- Runtime source of truth: Node `20.x` from `package.json` and `.github/workflows/ci.yml`.
- Local shell observed on 10 August 2026: Node `24.13.0`, npm `11.6.2`.
- Consequence: local checks can find regressions, but an official build result must come from Node 20 CI or a Node 20 environment.
- Machine-readable snapshot: [`docs/seo/seo-baseline-2026-08-10.json`](seo/seo-baseline-2026-08-10.json).

The exact base commit was refreshed from `origin/main` and had no local/remote divergence at the time of capture. GitHub reported both Node 20 checks successful: [CI build](https://github.com/zaidshery/Zaid-lokswami/actions/runs/31170356583/job/92840571673) and [Hostinger package](https://github.com/zaidshery/Zaid-lokswami/actions/runs/31170356581/job/92840571876). Those checks cover the base commit, not the uncommitted Phase 0 changes in this branch.

## July KPI baseline

These figures are imported from the July 2026 report. They are not claimed as current Search Console or CrUX measurements.

| Metric | July baseline |
| --- | ---: |
| Google clicks | 1.34K |
| Google impressions | 5.24K |
| Duplicate without user-selected canonical | 42 URLs |
| Crawled, currently not indexed | 29 URLs |
| Noindex | 13 URLs |
| Not found (404) | 9 URLs |
| Redirect | 8 URLs |
| Poor mobile URLs | 106 |
| Article share of views | 15.3% |

## GSC Performance Snapshot

Source archive: `https___lokswami.com_main_-Performance-on-Search-2026-08-10.zip` (19,598 bytes; SHA-256 `9b6b1d9075b5472c9437abca6a156a4878d44a2475d572da8408ab7c989cde75`). The archive opened successfully, every entry was read completely, and all seven entries are CSV files.

| CSV | Rows | Grain / purpose |
| --- | ---: | --- |
| `Chart.csv` | 140 | Daily property totals |
| `Queries.csv` | 214 | Exported query rows |
| `Pages.csv` | 481 | Exported landing-page rows |
| `Countries.csv` | 54 | Country distribution |
| `Devices.csv` | 3 | Device distribution |
| `Search appearance.csv` | 2 | Explicit search-appearance types |
| `Filters.csv` | 2 | Applied export filters |

Applied filters are **Search type: Web** and **Date: Last 12 months**. Despite the selected 12-month filter, `Chart.csv` contains a continuous 140-day range from **2026-03-22 through 2026-08-08**. The observed chart totals are **3,265 clicks**, **14,719 impressions**, and **22.18% overall CTR** (`clicks / impressions`).

### Branded-query classification

The classification applies only to rows actually present in `Queries.csv`. Each query is Unicode NFKC-normalized, lowercased, stripped of punctuation, and spacing is collapsed while preserving Unicode letters, combining marks, and digits. A row is branded when its normalized text contains:

- `lokswami`, `lok swami`, `lokswami epaper`, `lok swami epaper`, or a longer phrase containing those tokens;
- reasonable Latin spelling/spacing variants: `lokswamy`, `loksawami`, `loksawmi`, `lokaswami`, `loksvami`, `lokswaami`, or `loksami`;
- Devanagari variants `लोकस्वामी`, `लोक स्वामी`, `लोकस्वामि`, or `लोकसवामी`;
- a longer historic-name phrase such as `sanjha lokswami` when it still contains a recognized Lokswami token.

Ambiguous partial or different names such as `loksw`, `lokswar`, `swami paper`, `lok paper`, and `lok samachar` are not automatically branded.

| Segment | Rows | Clicks | Impressions | CTR |
| --- | ---: | ---: | ---: | ---: |
| Branded | 26 | 1,706 | 4,393 | 38.83% |
| Non-branded | 188 | 78 | 2,425 | 3.22% |
| All exported query rows | 214 | 1,784 | 6,818 | 26.17% |
| Chart totals not present in query rows; classification unavailable | n/a | 1,481 | 7,901 | n/a |

Branded and non-branded rows reconcile exactly to the exported query-row totals. They do **not** reconcile to `Chart.csv`, so the missing 1,481 clicks and 7,901 impressions remain unclassified rather than being assigned to non-branded traffic.

Top exported queries by clicks:

| Query | Class | Clicks | Impressions | CTR |
| --- | --- | ---: | ---: | ---: |
| `lokswami epaper` | Branded | 726 | 864 | 84.03% |
| `lokswami paper` | Branded | 422 | 697 | 60.55% |
| `lok swami epaper indore` | Branded | 94 | 124 | 75.81% |
| `lokswami epaper indore` | Branded | 63 | 150 | 42.00% |
| `lokswami` | Branded | 52 | 540 | 9.63% |
| `लोकस्वामी पेपर इंदौर` | Branded | 43 | 115 | 37.39% |
| `lok swami newspaper` | Branded | 41 | 300 | 13.67% |
| `lokswami news indore today` | Branded | 40 | 195 | 20.51% |
| `lokswami e paper today` | Branded | 40 | 82 | 48.78% |
| `lokswami newspaper` | Branded | 38 | 178 | 21.35% |

Top exported non-branded queries by clicks:

| Query | Clicks | Impressions | CTR |
| --- | ---: | ---: | ---: |
| `ऐश्वर्या राय बच्चन` | 18 | 115 | 15.65% |
| `khushi kulwal` | 13 | 51 | 25.49% |
| `अभिषेक बच्चन` | 9 | 64 | 14.06% |
| `कियारा आडवाणी` | 6 | 82 | 7.32% |
| `epaper indore` | 4 | 44 | 9.09% |

### Top landing pages

| Page | Clicks | Impressions | CTR |
| --- | ---: | ---: | ---: |
| `https://lokswami.com/main/epaper` | 2,648 | 7,526 | 35.18% |
| `https://lokswami.com/main/epaper?city=indore` | 107 | 3,210 | 3.33% |
| `/main/article/khushi-kulwal-suicide-case-reinvestigation-indore-crime-branch` | 35 | 175 | 20.00% |
| `/main/article/abhishek-bachchan-aishwarya-rai-new-york-selfie-with-fan-viral` | 27 | 185 | 14.59% |
| `/main/epaper?city=indore&date=2026-07-21` | 24 | 118 | 20.34% |
| `/main/epaper?city=indore&date=2026-06-24` | 19 | 71 | 26.76% |
| `/main/epaper?city=indore&date=2026-06-25` | 18 | 49 | 36.73% |
| `/main/epaper?city=indore&date=2026-05-29` | 16 | 171 | 9.36% |
| `/main/contact` | 15 | 276 | 5.43% |
| `/main/latest` | 14 | 1,509 | 0.93% |

The 481 exported page rows sum to 3,329 clicks and 25,602 impressions. These page-row sums differ from the property-level chart totals and are retained only as dimension-row aggregates, not substituted for `Chart.csv` totals.

### Device, country, and search appearance

Device rows reconcile exactly to the chart totals.

| Device | Clicks | Click share | Impressions | Impression share | CTR |
| --- | ---: | ---: | ---: | ---: | ---: |
| Mobile | 2,835 | 86.83% | 12,379 | 84.10% | 22.90% |
| Desktop | 405 | 12.40% | 2,261 | 15.36% | 17.91% |
| Tablet | 25 | 0.77% | 79 | 0.54% | 31.65% |

Country rows also reconcile exactly to the chart totals. India accounts for 3,228 clicks (98.87%) and 14,138 impressions (96.05%). The next countries by clicks are United Arab Emirates (10/60), Kuwait (9/28), Armenia (5/9), Singapore (3/10), and Saudi Arabia (3/3); the remaining 48 countries combine to 7 clicks and 471 impressions.

`Search appearance.csv` contains only two explicit appearance rows: Videos (1 click, 3 impressions, 33.33% CTR) and Translated results (0 clicks, 7 impressions, 0% CTR). These rows are a small labeled subset, not a reconciliation of all search traffic.

## GSC Page Indexing/Coverage Snapshot

Source archive: `https___lokswami.com_main_-Coverage-2026-08-10.zip` (1,320 bytes; SHA-256 `2692f0f8ead6b2055ceaaac3fa08724043f87d6e563e651df7776490827e59be`). The archive opened successfully, every entry was read completely, and all four entries are CSV files.

| CSV | Rows | Grain / purpose |
| --- | ---: | --- |
| `Chart.csv` | 88 | Daily aggregate indexing totals |
| `Critical issues.csv` | 7 | Aggregate issue categories |
| `Non-critical issues.csv` | 0 | No exported rows |
| `Metadata.csv` | 1 | Scope: Sitemap = All known pages |

The coverage chart is continuous from 2026-05-12 through 2026-08-07; the first three rows do not contain indexed/not-indexed counts, and the first complete count is 2026-05-15. On the latest available date, **2026-08-07**, GSC reports **635 indexed pages**, **209 not-indexed pages**, **844 total known pages**, and a **75.24% indexing ratio**.

| Issue | Source | Validation | Pages |
| --- | --- | --- | ---: |
| Alternate page with proper canonical tag | Website | Not Started | 94 |
| Not found (404) | Website | Not Started | 37 |
| Duplicate without user-selected canonical | Website | Not Started | 29 |
| Excluded by `noindex` tag | Website | Not Started | 16 |
| Page with redirect | Website | Not Started | 10 |
| Crawled - currently not indexed | Google systems | Not Started | 23 |
| Discovered - currently not indexed | Google systems | N/A | 0 |
| **Issue total** |  |  | **209** |

The issue total reconciles exactly to the latest not-indexed total: **209 - 209 = 0 difference**. This is a count reconciliation only; it does not provide URL-level evidence or justify any remediation decision.

## Data Limitations and Missing Phase 1 Inputs

- `Queries.csv` totals (1,784 clicks, 6,818 impressions) and `Pages.csv` totals (3,329 clicks, 25,602 impressions) differ from `Chart.csv` totals (3,265 clicks, 14,719 impressions). GSC dimension exports can differ because of export limits, anonymized queries, privacy filtering, and aggregation behavior. `Chart.csv` remains the property-total source, and no explanation beyond the exported evidence is asserted.
- Branded/non-branded metrics cover only the 214 visible query rows. The Chart-minus-query difference remains **unclassified**, not non-branded.
- The selected filter says Last 12 months, but the actual available Performance chart range is only 2026-03-22 through 2026-08-08.
- The Coverage ZIP contains aggregate counts and issue categories only. It contains no affected URL examples and no URL column.
- Consequently, redirect, canonical, noindex, 404/410, sitemap-membership, and URL-disposition decisions cannot be made from these exports.
- Phase 1 still requires a URL-level Page Indexing examples export/list mapping each affected URL to its GSC issue reason. Ambiguous URLs will require manual review. Phase 1 has not started.

## Current code reconciliation

| Area | Evidence in the checkout | Status | Next phase |
| --- | --- | --- | --- |
| Article SEO fields and validation | `lib/seo/articleSeo.ts`, CMS article create/edit modules, API validation | Implemented | 7 for newsroom policy |
| Canonical and slug history | Server article metadata plus previous-slug resolution | Partial; GSC examples are not reconciled | 1, then 3 |
| NewsArticle JSON-LD | Public article layout generates metadata/schema | Implemented | 3 for BreadcrumbList/site schema |
| Standard sitemap | `app/sitemap.ts` includes static, category, article and publication URLs | Implemented with a 5,000 article ceiling | 3 |
| Google News sitemap | `app/news-sitemap.xml/route.ts` uses eligible recent published stories | Implemented | 3 hardening |
| Publication safety | Sitemap services use published-article rules and Mongo/file-store fallback | Implemented and covered | Preserve in every phase |
| Full article initial HTML | `app/(reader)/main/article/[id]/page.tsx` is a Client Component, fetches in `useEffect`, and initially renders `लेख लोड हो रहा है...` | Missing | 2 |
| Core Web Vitals field events | No supported LCP/INP/CLS reporting path was identified in Phase 0 | Missing | 4 |
| Engagement/session governance | Existing analytics does not yet meet the plan's 30-minute and engagement-event model | Partial | 6 |

## Reproducible commands

Run the official gate on Node 20.x:

```powershell
npm.cmd ci
npm.cmd run verify:dependency-security
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test -- --reporter=dot
npm.cmd run build:ci
```

Run the read-only SEO smoke against local, staging, or production:

```powershell
npm.cmd run test:seo-smoke -- --baseUrl=https://lokswami.com --articleUrl=/main/article/known-published-slug
```

If `--articleUrl` is omitted, the script discovers one published item from `/api/v1/public/articles?limit=5`. It checks robots, standard/news XML sitemaps, homepage, a category, e-paper, canonical tags, and the selected article's initial HTML. Until Phase 2 is complete, the article assertion is expected to fail loudly with `Known Phase 2 article SSR gap`; the defect is not treated as a passing check.

## Live evidence protocol

Record the following for each live run without copying secrets or personal data:

- UTC timestamp and deployed commit/package identifier.
- Base URL and selected public article URL.
- Status and content type for robots, both sitemaps, homepage, category, e-paper, and article.
- Canonical URL found in initial HTML.
- Whether initial HTML contains a substantive `h1`, a marked article body with a substantive paragraph, and no loading placeholder.
- CI workflow URL for the same commit when available.

Phase 0 does not submit sitemaps, change Search Console state, create redirects, or mutate content.

### Live run captured at 2026-08-10T07:26:15Z

Command:

```powershell
npm.cmd run test:seo-smoke -- --baseUrl=https://lokswami.com --timeoutMs=30000
```

Passing checks:

- `/robots.txt` returned plain text and advertised the standard and news sitemaps.
- `/sitemap.xml` and `/news-sitemap.xml` returned sitemap XML.
- `/main`, `/main/category/politics`, `/main/epaper`, and the selected article returned initial HTML with same-origin canonicals.

Known failing check retained for Phase 2:

- Selected article: `https://lokswami.com/main/article/bhopal-berasia-road-closed-halali-banganga-river-heavy-rain-school-holiday`.
- Initial HTML had no substantive `h1`.
- Initial HTML had no marked article body with a substantive paragraph.
- Initial HTML still contained `लेख लोड हो रहा है...`.

### Phase 0 branch verification

- Focused Vitest: `tests/seo-smoke-check.test.ts` - 6 passed.
- Focused ESLint: `scripts/seo-smoke-check.js` and `tests/seo-smoke-check.test.ts` - passed.
- TypeScript: `npm.cmd run typecheck` - passed under the locally available Node 24.13.0.
- Dependency security floor: passed.
- Full ESLint: passed with 0 errors and 7 pre-existing warnings.
- Full Vitest: 153 files and 589 tests passed.
- `npm.cmd run build:ci`: passed; Next.js compiled in 9.1 minutes and generated 165 static pages. The expected MongoDB-unavailable sitemap fallback warning appeared.
- These branch checks ran under local Node 24.13.0. The exact base commit has successful Node 20 CI/build and Hostinger package checks; the Phase 0 branch still needs Node 20 CI before merge.

## Rollback

Revert the Phase 0 branch. The added script performs GET requests only and has no write mode. No runtime route or database schema is changed.
