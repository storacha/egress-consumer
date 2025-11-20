# Egress Consumer Worker

Cloudflare Worker that consumes pre-built `space/content/serve/egress/record` UCAN invocations from the egress tracking queue and batches them into a CAR file to be processed by the upload-api.

## Architecture

```
Freeway → CF Queue (serialized invocations) → Egress Consumer → Upload-API (batched CAR)
```

## Features

- **Consumes from Cloudflare Queue**: Processes egress tracking events asynchronously
- **Batches UCAN invocations**: Groups up to 50 invocations per upload-api request
- **Pre-built invocations**: No UCAN reconstruction needed - just deserialize and batch
- **Error handling**: Automatic retries with dead letter queue support

## Configuration

### Environment Variables

- `UPLOAD_API_URL`: URL of the upload-api service (default: https://up.storacha.network)

### Egress Consumer (Production)

- **Batch Size**: 100 messages (`max_batch_size = 100`) - Increased to maximum
- **Batch Timeout**: 60 seconds (`max_batch_timeout = 60`) - Increased to maximum
- **CPU Time**: 300,000 ms (5 minutes) - Increased to maximum
- **Max Retries**: 3
- **Dead Letter Queue**: `egress-dlq-production`

## Development

### Install dependencies
```sh
pnpm install
```

### Run locally
```sh
npx wrangler dev
```

### Deploy to Cloudflare (staging)
```sh
npx wrangler deploy -e staging
```

### Deploy to Cloudflare (production)
```sh
npx wrangler deploy -e production
```

### Complete Architecture Flow
1. **Freeway** → Cloudflare Queue (`egress-tracking-queue-production`)
2. **Egress Consumer** → Batches messages into CAR file → **POST to `/ucan` endpoint**
3. **Upload-API `/ucan` endpoint** → AWS Kinesis Stream (`ucan-stream-v2`)
4. **Kinesis Stream** → Lambda (`ucan-invocation-router`) → Processes UCAN invocations
5. **Upload-API handler** → AWS SQS Queue (`egress-traffic-queue`) for each egress event
6. **Billing System** → DynamoDB (`egress-traffic` table) → Stripe Billing Meter API
