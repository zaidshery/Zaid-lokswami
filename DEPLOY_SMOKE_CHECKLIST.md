# Deploy Smoke Checklist

Run this after every production deploy before calling the release complete.

## Automated Checks

Run:

```bash
npm run test:smoke -- https://your-domain.com
```

Current production example:

```bash
npm run test:smoke -- https://lokswami.com
```

The automated smoke script checks:

- `/api/health` returns `status=ok` and `db=connected`
- `/signin` returns `200`
- `/main` returns `200`
- `/main/epaper` returns `200`
- guest access to `/admin` redirects to `/signin?redirect=%2Fadmin`
- `/api/epapers/latest?limit=1` returns at least one item
- the latest public e-paper PDF route returns a redirect URL

If the script fails, stop and fix the deploy before moving on.

## Manual Checks

Complete these in a real browser session:

1. Open `/signin` and sign in with the expected admin method.
2. Confirm `/admin` loads without redirect loops or auth errors.
3. Open `/admin/articles` and `/admin/epapers` and confirm list data loads.
4. Perform one small upload through the CMS.
5. Confirm the uploaded asset is saved and visible where expected.
6. Open `/main/epaper` and confirm the latest edition still opens for readers.

## Admin Runtime Follow-Up

After this checklist passes, run:

```bash
npm run test:admin-runtime -- https://your-domain.com
```

Then complete the signed-in checks in `ADMIN_RUNTIME_CHECKLIST.md`.

## Upload Recommendation

For the required upload smoke test, prefer one of these:

- upload a small article image from `/admin/articles/new`
- upload a small e-paper thumbnail from `/admin/epapers/new`

If the deploy changed e-paper storage, Cloudinary config, or file permissions, test an e-paper upload specifically.

## Release Rule

Do not mark a deploy healthy until:

- the automated smoke script passes
- admin login works
- one CMS upload succeeds
