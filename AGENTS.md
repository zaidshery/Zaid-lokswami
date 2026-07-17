# Repository guidance for coding agents

## Project shape

- This is a Next.js 15 App Router newsroom product using TypeScript, React, MongoDB/Mongoose, and file-store fallbacks.
- Reader routes live under `app/(reader)`, CMS routes under `app/(admin)`, API routes under `app/api`, and shared domain logic under `lib`.
- Preserve the existing reader and CMS visual language. Prefer extending shared components and domain helpers over creating parallel implementations.

## Product rules

- E-paper is a daily, city/edition-based publication.
- E-magazine is a monthly issue product. Do not copy daily E-paper date, scheduling, edition, or CMS assumptions into E-magazine flows.
- Reuse the existing `publicationType`, base-path, and storage-folder seams when changing shared E-paper/E-magazine infrastructure.
- Homepage placement is editorially meaningful: Breaking stories receive priority in **Live Updates**; Trending stories receive priority in **Popular News**. Both rails must backfill from published articles so sparse flags do not produce empty UI.
- CMS labels and help text must tell editors where a setting appears on the public reader site and explain any publication requirement or expiry behavior.

## Implementation expectations

- Keep public article visibility aligned with the publication workflow; drafts, scheduled items not yet due, and non-published articles must not leak into reader feeds.
- Keep MongoDB and file-store behavior compatible when touching article or publication persistence.
- Use `isMongoAvailable({ label: ... })` for build-sensitive public paths that need a fast fallback when MongoDB is unavailable.
- Preserve unrelated working-tree changes. Do not rewrite generated or data files unless the task requires it.
- Use `apply_patch` for hand-authored file edits and `rg` / `rg --files` for repository search.

## Verification

- Add or update focused Vitest coverage for changed behavior.
- Run the focused tests first, then `npm run typecheck`.
- For CMS or reader UI changes, run relevant Playwright/browser checks when practical.
- Before deployment-sensitive work is considered complete, run `npm run build:ci`; run `npm run verify:prod-env` when environment requirements change.
- A quiet `next build` optimization phase is normal in this repository and is not by itself evidence of a hang.
