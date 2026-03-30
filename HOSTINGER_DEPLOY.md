# Hostinger Deployment

This project is now prepared for a standard Hostinger Node.js deployment.

This is the only documented production deployment target for the repo. Remove any old non-Hostinger production examples from active environment files and OAuth settings.

Assumption:
- You are deploying to Hostinger Node hosting or a Hostinger VPS.
- You are not deploying to PHP-only shared hosting.

## Required Runtime

- Node.js 20 or newer
- MongoDB Atlas or another persistent MongoDB
- Writable app directory for `data/` and `storage/uploads/`

## Required Environment Variables

Minimum production env:

```env
MONGODB_URI=
NEXTAUTH_SECRET=
NEXTAUTH_URL=https://your-domain.com
NEXT_PUBLIC_SITE_URL=https://your-domain.com
ADMIN_LOGIN_ID=admin
ADMIN_PASSWORD_HASH=
```

Example for the current production site:

```env
NEXTAUTH_URL=https://lokswami.com
NEXT_PUBLIC_SITE_URL=https://lokswami.com
```

Recommended if uploads are enabled:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
EPAPER_STORAGE_UPLOADS_BASE_DIR=storage/uploads
```

Optional if you use Google login:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ADMIN_EMAILS=
```

Optional AI / OCR:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OCR_SPACE_API_KEY=
OCR_SPACE_LANGUAGE=hin
GEMINI_API_KEY=
GEMINI_TTS_MODEL=gemini-2.5-flash-preview-tts
GEMINI_TTS_VOICE=Charon
```

## Google OAuth Production Redirect

If Google login is enabled, add these in Google Cloud Console:

- Authorized JavaScript origin: `https://your-domain.com`
- Authorized redirect URI: `https://your-domain.com/api/auth/callback/google`

If you are using the current production domain, that means:

- Authorized JavaScript origin: `https://lokswami.com`
- Authorized redirect URI: `https://lokswami.com/api/auth/callback/google`

## Build And Start Commands

Use these commands on the server:

```bash
npm ci
npm run build:hostinger
npm run start:hostinger
```

Recommended release flow:

1. Update production env values in Hostinger.
2. Run `npm ci`.
3. Run `npm run build:hostinger`.
4. Restart with `npm run start:hostinger` or the Hostinger app restart control.
5. Run the smoke checks before calling the deploy complete.
6. Run the admin runtime checks before calling admin healthy.

Rollback command:

```bash
npm run rollback:hostinger
npm run start:hostinger
```

That marks the previous prepared release as pending and then promotes it on restart.

What `build:hostinger` does:

- preserves the currently live legacy static bundle before clearing `.next` during the migration from the old in-place flow
- builds the Next.js app into `.next`
- snapshots the new `.next/static` output
- prepares a versioned standalone release under `.hostinger/releases/<build-id>`
- copies `public/` into that prepared release
- merges a short overlap window of older hashed `/_next/static/*` assets into the new release so stale HTML can still resolve its chunks during rollout
- records the prepared release in `.hostinger/release-state.json`

What `start:hostinger` does now:

- promotes the most recently prepared release to current only when the process starts
- starts the promoted release from `.hostinger/releases/<build-id>/server.js`
- prunes older release directories after promotion

This avoids the old failure mode where an in-place build deleted the currently running `.next/standalone/.next/static` files before the new release was fully live.

## Hostinger hPanel Node App

Recommended settings:

- Application root: project root
- Build command: `npm run build:hostinger`
- Start command: `npm run start:hostinger`
- Node version: `20` or newer

After deploy, verify:

- homepage loads
- `/api/health` returns `status: ok`
- admin login works
- guest access to admin pages and admin APIs is blocked
- uploads work
- Google sign-in works if enabled
- article, e-paper, breaking news, and AI listen features generate Gemini audio

## Hostinger VPS

Typical flow:

```bash
npm ci
npm run build:hostinger
PORT=3000 npm run start:hostinger
```

Then reverse proxy with Nginx to your domain.

## Writable Paths

This app writes runtime data to:

- `data/`
- `storage/uploads/`

If Hostinger restricts writes inside the app root, set:

```env
EPAPER_STORAGE_UPLOADS_BASE_DIR=/absolute/path/to/writable/storage/uploads
```

## Important Notes

- Do not rely on local JSON data as your primary production database.
- Use MongoDB in production.
- If production uploads are important, configure Cloudinary.
- Keep `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL` on the same final domain.
- Regenerate `NEXTAUTH_SECRET` only if you are okay invalidating sessions.
- Do not delete `.hostinger/` between deploys. It stores the active release plus recent static snapshots for safe chunk overlap.
- If you need to tune overlap or release retention, set `HOSTINGER_STATIC_OVERLAP_RELEASES` and `HOSTINGER_RELEASE_RETENTION`.

## Quick Smoke Test

After deployment:

1. Run `npm run test:smoke -- https://your-domain.com`
2. Run `npm run test:admin-runtime -- https://your-domain.com`
3. Complete the manual checks in `DEPLOY_SMOKE_CHECKLIST.md` and `ADMIN_RUNTIME_CHECKLIST.md`

The smoke script now validates HTML asset integrity for `/signin`, `/main`, and `/main/epaper` by parsing the live HTML and checking that every referenced JS/CSS file under `/_next/static/*` returns `200` with the correct content type.
