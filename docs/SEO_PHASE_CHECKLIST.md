# SEO Phase Checklist

This checklist keeps the August SEO plan reviewable. Only one phase should be active in a branch or pull request.

| Phase | Scope | Status | Approval/evidence gate |
| --- | --- | --- | --- |
| 0 | Baseline lock and read-only SEO smoke | In progress | Node 20 quality gate and live read-only evidence |
| 1 | Search Console URL inventory and canonical dry run | Pending | Current GSC CSV/export and manual review of ambiguous URLs |
| 2 | Full article SSR and crawlable related links | Pending | Approved server/client boundary and publication-safety tests |
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
- [ ] Current Phase 0 branch passes Node 20 CI before merge.
- [x] Live evidence is recorded for the deployed base commit, including the expected article SSR failure.

## Non-negotiable safeguards

- Preserve published-only reader visibility and MongoDB/file-store parity.
- Keep URL audits read-only until a reviewed mapping exists.
- Never bulk redirect, delete content, or activate analytics TTL in an SEO phase without an explicit dry run and approval.
- Verify both initial HTML and hydrated browser behavior for public reader changes.
- Do not claim indexing or production acceptance from a local-only result.
