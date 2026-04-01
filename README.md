# Lokswami

Hindi news PWA built on Next.js 15 with TypeScript, Tailwind CSS, MongoDB, Zustand, and NextAuth session auth.

## Stack

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- MongoDB + Mongoose
- NextAuth v5 beta
- Zustand
- Framer Motion

## App Structure

Route groups keep public URLs unchanged:

- `app/(auth)` -> `/login`, `/signin`
- `app/(admin)` -> `/admin`, `/dashboard`, admin CMS pages
- `app/(reader)` -> `/main/*`, `/article/[id]`, section pages
- `app/(marketing)` -> `/`, `/about`, `/advertise`, `/careers`, `/contact`, `/digital-newsroom`

Shared components live at the top level:

- `components/ui`
- `components/layout`
- `components/forms`
- `components/providers`
- `components/auth`
- `components/ai-chat`

## Authentication

- Single auth system: NextAuth sessions
- Unified sign-in page: `/signin`
- `/login` permanently redirects to `/signin`
- Reader sign-in can use Google OAuth
- Admin sign-in can use env-backed credentials and optionally Google allowlisting
- Middleware protects `/admin/*` plus reader-only routes such as `/main/saved` and `/main/preferences`

## Environment

Copy `.env.local.example` to `.env.local` and set the values you actually use.

Minimum local setup for admin credentials sign-in:

```env
MONGODB_URI=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
ADMIN_LOGIN_ID=admin
ADMIN_PASSWORD_HASH=
```

Add Google OAuth only if you want Google sign-in:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Also supported:

- `ADMIN_USERNAME` instead of `ADMIN_LOGIN_ID`
- `JWT_SECRET` or `AUTH_SECRET`
- `ADMIN_EMAILS`, `ADMIN_GOOGLE_LOGIN_ENABLED`
- `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GTM_ID`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `OPENAI_API_KEY`, `OPENAI_MODEL`
- `GEMINI_API_KEY`, `GEMINI_TTS_MODEL`, `GEMINI_TTS_VOICE`
- `OCR_*`
- `NEXT_IMAGE_ALLOWED_HOSTS`

## Local Development

```bash
npm install
npm run seed
npm run dev
```

Open `http://localhost:3000`.

Useful checks:

```bash
npm run lint
npm run typecheck
npm run build
```

## Seeding

Seed data comes from `scripts/seed-fixtures.json`.

- `npm run seed` executes `scripts/seed.js`
- Fixtures are intentionally small
- Seeding recreates `Article`, `Category`, and `Author` data

## API Overview

Auth:

- `GET/POST /api/auth/[...nextauth]`

Admin CMS:

- `/api/admin/articles`
- `/api/admin/categories`
- `/api/admin/stories`
- `/api/admin/videos`
- `/api/admin/epapers`
- `/api/admin/epapers/import`
- `/api/admin/media`
- `/api/admin/upload`
- `/api/admin/contact-messages`

Public content:

- `/api/articles/latest`
- `/api/videos/latest`
- `/api/shorts/latest`
- `/api/epapers`
- `/api/epapers/latest`
- `/api/public/epapers/[id]/pdf`
- `/api/public/uploads/[...path]`

AI and utility:

- `/api/ai/search`
- `/api/ai/summary`
- `/api/ai/tts`
- `/api/ai/suggestions`
- `/api/ai/categories`
- `/api/analytics/track`
- `/api/contact`
- `/api/advertise/inquiry`
- `/api/careers/apply`
- `/api/subscribe`
- `/api/health`

## E-Paper Admin Workflow

Lokswami now supports two admin creation flows at `/admin/epapers/new`:

- `Direct upload`: upload PDF + thumbnail, then optionally upload page images immediately or later.
- `Google Drive / URL import`: paste shared PDF/image URLs. The server downloads those assets and creates the e-paper in the normal admin pipeline.

What the import flow supports:

- absolute `http(s)` URLs
- Google Drive shared file links
- optional page-image URLs, one per line

Current limitation:

- imported editions still use cloud-hosted PDF assets, so server-side `Generate Page Images` is currently unavailable for those editions
- for imported editions, page images should be supplied during import or uploaded later from the e-paper detail page

## E-Paper Readiness

Admin e-paper list and detail pages now show publish readiness:

- `Ready`: no blockers and no review warnings
- `Needs review`: publishable structure exists, but hotspot/text review is still recommended
- `Not ready`: required assets or mappings are missing

Readiness currently checks:

- page-image coverage
- hotspot coverage across pages
- readable story text coverage
- missing thumbnail / missing PDF

## Deployment

Hostinger Node deployment is the supported production path for this repo.

- Set `NEXTAUTH_URL` to your final Hostinger domain
- Set `NEXT_PUBLIC_SITE_URL` to that same domain
- Set `NEXT_PUBLIC_GTM_ID` only if you want GTM live in production
- Add `https://<your-domain>/api/auth/callback/google` to the Google OAuth client if Google login is enabled
- Keep `NEXTAUTH_SECRET` at 32+ characters
- Use a persistent MongoDB instance
- Configure Cloudinary if production uploads are enabled
- `public/uploads/*` and `data/articles.json` are gitignored local/generated data
- Deploy with `npm run build` and `npm start`
- Do not swap production start to `next start` or `node .next/standalone/server.js`, because that bypasses the managed Hostinger release flow
- `npm run build:hostinger` and `npm run start:hostinger` remain as explicit aliases for the same Hostinger flow
- Roll back to the previous prepared Hostinger release with `npm run rollback:hostinger` and then `npm run start:hostinger`
- The Hostinger flow now stages versioned releases in `.hostinger/releases/*` and keeps a short overlap of older hashed `/_next/static/*` assets to prevent post-deploy `ChunkLoadError` crashes
- `npm run test:smoke -- https://your-domain.com` now checks live HTML asset integrity, not just status codes
- See `HOSTINGER_DEPLOY.md` for the full server checklist

## Project Docs

- `HOSTINGER_DEPLOY.md` for the production deployment flow
- `DEPLOY_SMOKE_CHECKLIST.md` for the post-deploy verification pass
- `ADMIN_RUNTIME_CHECKLIST.md` for production admin and CMS verification
- `NEXT_SPRINT.md` for the current priority order and sprint direction

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run test:smoke -- https://your-domain.com
npm run test:admin-runtime -- https://your-domain.com
npm run seed
npm run hash-password
npm run migrate:epapers
```
