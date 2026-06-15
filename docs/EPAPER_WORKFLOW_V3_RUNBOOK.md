# E-Paper Workflow V3 Runbook

## Required Environment

```env
EPAPER_BACKGROUND_PROCESSING_ENABLED=1
EPAPER_BACKGROUND_PROCESSING_CITY_ALLOWLIST=
EPAPER_STUCK_WARNING_HOURS=6
ADMIN_CRON_SECRET=replace-with-a-long-random-secret
```

Keep the processing city allowlist populated during the first production
rollout. An empty allowlist enables every city.

## Database Migration

Run the migration against a production backup before enabling background
processing:

```bash
npm run migrate:epaper-workflow-v3
npm run migrate:epaper-workflow-v3:write
```

The first command is a dry run. The write command adds revision metadata,
defaults existing pages to `editorial`, and creates the workflow indexes.

## Hostinger Cron

Configure a one-minute HTTP cron that sends:

```http
POST https://lokswami.com/api/admin/epapers/jobs/run-due
X-Cron-Secret: <ADMIN_CRON_SECRET>
```

Example:

```bash
curl --fail --silent --show-error \
  --request POST \
  --header "X-Cron-Secret: $ADMIN_CRON_SECRET" \
  https://lokswami.com/api/admin/epapers/jobs/run-due
```

Each invocation leases at most one job. Processing is persisted after every
page, and failed pages are retried after approximately 1, 5, and 15 minutes.

## Rollout

1. Deploy with `EPAPER_BACKGROUND_PROCESSING_ENABLED=0`.
2. Run and review the migration dry run, then apply it.
3. Set the city allowlist to one city and enable processing.
4. Upload a PDF and verify page progress, page-one cover selection, OCR review,
   QA blockers, and publication.
5. Confirm the public reader serves the published current revision.
6. Clear the city allowlist to enable processing globally.

## Rollback

Set `EPAPER_BACKGROUND_PROCESSING_ENABLED=0` to stop new worker claims. Existing
edition records and successfully rendered pages remain intact. Re-enable the
flag to resume queued work; successful pages are not regenerated.

Do not remove the workflow indexes or revision fields during an application
rollback. They are backward-compatible with older records and preserve the
published revision history.
