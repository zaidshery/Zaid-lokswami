# SEO Indexing Audit Runbook

## Scope and safety

This Phase 1 tool turns native Google Search Console Page Indexing exports into a traceable canonical/indexing dry run. It is strictly read-only: it reads local ZIP files, makes only HTTP `GET` requests, and writes reports under the ignored `.seo-audit/` directory. It does not change redirects, canonicals, noindex directives, sitemaps, content, Search Console state, or database records.

The audit is evidence, not an implementation plan. `MANUAL_REVIEW` is required whenever a replacement or disposition is ambiguous. In particular, the tool does not infer replacement targets for legacy `/main/stories` URLs or repair malformed URL values.

## Required inputs

Export the six URL-level Page Indexing issue archives and one aggregate Page Indexing/Coverage archive from the same Search Console property and capture period:

1. Alternate page with proper canonical tag
2. Not found (404)
3. Duplicate without user-selected canonical
4. Excluded by `noindex` tag
5. Page with redirect
6. Crawled - currently not indexed
7. Overall Page Indexing/Coverage summary

Pass every archive explicitly with a separate `--zip` option. Issue identity comes from each archive's `Metadata.csv`, not its filename. The tool validates ZIP structure and CRCs, requires the native GSC headers, checks chart date continuity, and maps each issue archive to the corresponding Coverage reason. Every issue's `Table.csv` row count must match both its latest issue-chart count and its Coverage reason count, and every issue chart must end on the same latest reporting date as the Coverage chart. Aggregate issue and not-indexed totals are then reconciled separately.

CSV parsing follows RFC 4180, including quoted fields containing commas, quotes, CRLFs, or embedded newlines. The raw URL is retained exactly. Whitespace-containing or malformed URLs are not trimmed or repaired; they receive a processing error and `MANUAL_REVIEW` classification.

Do not copy ZIPs or extracted CSVs into the repository. Keep them in an external evidence directory such as the original report folder.

### Validated 2026-08-10 archive inventory

| Archive | Metadata classification | Contained CSVs |
| --- | --- | --- |
| `01-alternate-canonical-2026-08-10.zip` | Alternate page with proper canonical tag | `Chart.csv`, `Table.csv`, `Metadata.csv` |
| `02-not-found-404-2026-08-10.zip` | Not found (404) | `Chart.csv`, `Table.csv`, `Metadata.csv` |
| `03-duplicate-no-canonical-2026-08-10.zip` | Duplicate without user-selected canonical | `Chart.csv`, `Table.csv`, `Metadata.csv` |
| `04-excluded-noindex-2026-08-10.zip` | Excluded by `noindex` tag | `Chart.csv`, `Table.csv`, `Metadata.csv` |
| `05-page-with-redirect-2026-08-10.zip` | Page with redirect | `Chart.csv`, `Table.csv`, `Metadata.csv` |
| `06-crawled-not-indexed-2026-08-10.zip` | Crawled - currently not indexed | `Chart.csv`, `Table.csv`, `Metadata.csv` |
| `07-indexed-pages-2026-08-10.zip` | Aggregate Page Indexing/Coverage summary | `Chart.csv`, `Critical issues.csv`, `Non-critical issues.csv`, `Metadata.csv` |

## Command

Run with Node 20.x. PowerShell example:

```powershell
npm.cmd run audit:seo-indexing -- `
  --base-url=https://lokswami.com `
  --output-dir=.seo-audit/2026-08-10 `
  --concurrency=4 `
  --timeout-ms=20000 `
  --zip="D:\#1 zaidshery-lok\July report\01-alternate-canonical-2026-08-10.zip" `
  --zip="D:\#1 zaidshery-lok\July report\02-not-found-404-2026-08-10.zip" `
  --zip="D:\#1 zaidshery-lok\July report\03-duplicate-no-canonical-2026-08-10.zip" `
  --zip="D:\#1 zaidshery-lok\July report\04-excluded-noindex-2026-08-10.zip" `
  --zip="D:\#1 zaidshery-lok\July report\05-page-with-redirect-2026-08-10.zip" `
  --zip="D:\#1 zaidshery-lok\July report\06-crawled-not-indexed-2026-08-10.zip" `
  --zip="D:\#1 zaidshery-lok\July report\07-indexed-pages-2026-08-10.zip"
```

The tool refuses duplicate/missing/unknown issue mappings, duplicate or unexpected ZIP entries, unsafe member paths, oversized archives/entries, cross-row exact duplicates, invalid headers, corrupt ZIP entries, chart/Table mismatches, per-issue Coverage count differences, mixed latest reporting dates, or an aggregate Coverage reconciliation difference. ZIPs are limited to 20 entries, 10 MiB compressed/archive bytes, 5 MiB per uncompressed entry, and 10 MiB total declared uncompressed bytes. `--concurrency` is limited to 1-10, `--max-redirects` to 0-20, and the response-body limit is 5 MiB. Oversized declared bodies are rejected before reading; unknown-length bodies are counted incrementally and cancelled as soon as they exceed the limit. Redirects are followed manually only while they stay on the configured production origin, and request timeouts remain active through complete body consumption.

## Output

The ignored output directory contains:

- `seo-indexing-audit.json`: complete source metadata, reconciliation, summary, and row evidence.
- `seo-indexing-audit.csv`: spreadsheet-friendly copy of every row; formula-leading cells are prefixed in this CSV only, while JSON retains the exact source value.
- `seo-indexing-summary.json`: compact reconciliation and classification totals.

The JSON reconciliation section records each metadata-identified issue's archive row count, matching Coverage count, issue-chart latest date, and Coverage latest date so the accepted snapshot can be audited without relying on archive filenames or argument order.

Each original input row remains independently traceable through `rowId`, archive name, CSV row number, source issue, raw URL, and last-crawled date. The report captures:

- raw and normalized comparison URLs;
- a separately sorted logical comparison URL for query-order equivalence detection;
- live HTTP status, final URL, and redirect chain;
- canonical links, robots metadata, and `X-Robots-Tag`;
- standard/news sitemap membership;
- inferred content type;
- public article resolution and configured article canonical when available; article redirect targets require the original token to resolve through the published API and its returned slug to match the final public URL;
- proposed action, target, confidence, evidence, processing error, and manual-review reason;
- redirect loops, external/conflicting/missing canonicals, malformed URLs, sitemap/indexability conflicts, unpublished leakage, logical query duplicates, and unrelated many-to-one redirects.

Fragments, default ports, and trailing slashes are normalized for comparison. Meaningful query parameters are preserved. A second logical key sorts query pairs only to identify parameter-order equivalents; it does not replace or rewrite the raw URL.

## Classification meanings

| Action | Dry-run meaning |
| --- | --- |
| `KEEP` | Current evidence is consistent; no Phase 1 disposition change is proposed. |
| `SELF_CANONICAL` | A clean, indexable non-search 200 route lacks a canonical and may require its own final URL; an article also requires positive published/public resolution. |
| `REDIRECT_TO_REPLACEMENT` | A current redirect supplies an observed internal 200 target; the target is never guessed. |
| `INTENTIONAL_NOINDEX` | Current public-status/route evidence supports retaining noindex. |
| `REMOVE_FROM_SITEMAP` | A supplied URL is a sitemap member but is non-200, noindex, or proven non-public. |
| `INVESTIGATE_CONTENT` | Indexing/content evidence needs investigation without a safe automated URL action. |
| `MANUAL_REVIEW` | Evidence is ambiguous, malformed, conflicting, external, unreachable, or otherwise unsafe to automate. |

All classifications are proposals only. Phase 3 implementation still requires an approved row mapping.

## Manual review and spot checks

Review every `MANUAL_REVIEW`, every processing error, all `detections`, and every low-confidence record. Confirm at least ten representative rows across all six GSC issues by independently checking the raw source row, current status/final URL, canonical, robots directive, sitemap membership, and proposed action.

For malformed raw URLs, inspect the escaped JSON representation rather than pasting the value into a browser. For logical query equivalents, keep both original rows and confirm whether the route's canonical parameter order is deliberate. For many-to-one redirects, establish editorial/route equivalence before approving any mapping.

## Verification

```powershell
npm.cmd test -- tests/seo-indexing-audit.test.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build:ci
git diff --check
```

Generated reports, source ZIPs, and extracted CSVs must remain untracked. Before review, confirm that the report's `classifiedRows` equals `totalRows`; rows with an inspection problem must still have an explicit `processingError` and a safe classification.
