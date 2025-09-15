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

### Queue Configuration

- **Queue**: `egress-tracking-queue`
- **Batch size**: 50 invocations (conservative for Lambda timeout)
- **Timeout**: 30 seconds
- **Retries**: 3 attempts
- **Dead letter queue**: `egress-dlq`

## Development

### Install dependencies
```sh
pnpm install
```

### Run locally
```sh
pnpm run dev
```

### Deploy to Cloudflare (staging)
```sh
pnpm run deploy -- -e staging
```

### Deploy to Cloudflare (production)
```sh
pnpm run deploy -- -e production
```

## Performance

TBD
