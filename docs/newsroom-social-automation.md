# Newsroom Social Automation

Lokswami now supports an internal social automation outbox. Approved or scheduled social posts can be sent to:

- `manual`
- `n8n`
- `generic_webhook`

## Recommended free setup

For year-one newsroom automation, the best fit is:

- `n8n` if you want a visual workflow builder and self-hosted control
- `generic_webhook` if you already have another automation worker or integration service

## Environment variables

```env
SOCIAL_AUTOMATION_PROVIDER=n8n
N8N_SOCIAL_WEBHOOK_URL=https://your-n8n-instance.example/webhook/lokswami-social-dispatch
SOCIAL_AUTOMATION_SHARED_SECRET=replace-with-a-shared-secret
SOCIAL_AUTOMATION_TIMEOUT_MS=15000
```

If you are not using n8n, you can point the system to any webhook receiver:

```env
SOCIAL_AUTOMATION_PROVIDER=generic_webhook
SOCIAL_AUTOMATION_WEBHOOK_URL=https://automation.example/hooks/lokswami-social
SOCIAL_AUTOMATION_SHARED_SECRET=replace-with-a-shared-secret
```

## Dispatch flow

Admin opens `Social Posts` and clicks `Send To Automation`.

The app sends a signed JSON payload with:

- newsroom source IDs
- platform
- caption
- hashtags
- thumbnail URL
- video URL
- article URL
- source story URL
- actor metadata

## Suggested n8n workflow

1. `Webhook`
2. `IF` node to validate `X-Lokswami-Event`
3. `IF` node to validate the shared secret or signature
4. `Set` or `Code` node to normalize the payload
5. Optional AI step to refine caption or hashtags
6. Platform-specific publish or scheduling nodes
7. `Respond to Webhook`

Recommended response payload:

```json
{
  "success": true,
  "executionId": "n8n-execution-123",
  "executionUrl": "https://n8n.example/executions/123",
  "externalUrl": ""
}
```

## Safe rollout

Start with:

1. `draft` and `approved` social posts only
2. webhook dispatch
3. manual publish in downstream tools
4. save external URLs back into the social post record

After that, you can add:

1. YouTube publishing
2. Facebook Page publishing
3. Instagram Business publishing
4. AI-assisted caption variations
