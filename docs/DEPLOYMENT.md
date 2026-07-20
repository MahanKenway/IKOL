# Deployment Guide

This guide covers deploying Ikol Bot to Cloudflare Workers.

## Prerequisites

- Cloudflare account
- Node.js 18+
- npm or yarn
- Wrangler CLI installed globally:
  ```bash
  npm install -g wrangler
  ```

## Initial Setup

### 1. Authenticate with Cloudflare

```bash
npx wrangler login
```

### 2. Create D1 Database

```bash
npx wrangler d1 create ikol-db
```

Copy the database ID and update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "ikol-db"
database_id = "YOUR_DATABASE_ID"
```

### 3. Create KV Namespace

```bash
npx wrangler kv namespace create KV
```

Copy the namespace ID and update `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "KV"
id = "YOUR_KV_NAMESPACE_ID"
```

### 4. Create R2 Bucket (Optional)

```bash
npx wrangler r2 bucket create ikol-media
```

### 5. Set Secrets

```bash
npx wrangler secret put BOT_TOKEN
npx wrangler secret put BOT_WEBHOOK_SECRET
npx wrangler secret put GEMINI_API_KEY
# Add other secrets as needed
```

### 6. Run Migrations

```bash
npm run migrate
```

### 7. Deploy

```bash
npm run deploy
```

## Post-Deployment

### Set Telegram Webhook

After deployment, set the webhook URL:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://<your-worker>.workers.dev/"}'
```

Or use the `/setwebhook` command in your bot with the URL.

### Verify Deployment

1. Check the worker logs:
   ```bash
   npx wrangler tail
   ```

2. Send a message to your bot on Telegram

3. Check the health endpoint:
   ```bash
   curl https://<your-worker>.workers.dev/health
   ```

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `BOT_TOKEN` | Telegram Bot Token from @BotFather |
| `BOT_WEBHOOK_SECRET` | Secret for webhook verification |

### AI Providers (At least one required)

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key (free tier available) |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |

### Optional

| Variable | Description |
|----------|-------------|
| `NASA_API_KEY` | NASA API key (get from api.nasa.gov) |
| `STEAM_API_KEY` | Steam API key |
| `COBALT_API_URL` | Self-hosted Cobalt API URL |
| `COBALT_API_KEY` | Cobalt API key |

## Staging vs Production

### Staging

Deploy to staging environment:

```bash
npx wrangler deploy --env staging
```

### Production

Deploy to production:

```bash
npx wrangler deploy
```

## Monitoring

### View Logs

```bash
npx wrangler tail
```

### Check Metrics

Visit the Cloudflare Workers dashboard to view:
- Request count
- Response time
- Error rate
- CPU usage

## Troubleshooting

### Worker Not Responding

1. Check if the webhook is set correctly
2. Verify the worker is deployed
3. Check logs for errors

### Database Errors

1. Ensure migrations are run
2. Check D1 binding in `wrangler.toml`
3. Verify database ID is correct

### API Errors

1. Check that API keys are set as secrets
2. Verify the keys are valid
3. Check rate limits

## Rollback

To rollback to a previous version:

```bash
npx wrangler rollback
```

Or deploy a specific version:

```bash
npx wrangler deploy --compatibility-date 2024-01-01
```

## Cost Considerations

### Free Tier

- 100,000 requests/day
- 10ms CPU time per request
- 128MB memory

### Paid Plan ($5/month)

- 10,000,000 requests/month
- 30s CPU time per request
- 128MB memory

### D1 Database

- First 5GB storage free
- First 100,000 reads/day free
- First 100,000 writes/day free

### KV Storage

- 100,000 reads/day free
- 1,000 writes/day free
- 1GB storage free

## Security Best Practices

1. Never commit secrets to git
2. Use Cloudflare Secrets for sensitive data
3. Enable webhook secret verification
4. Implement rate limiting
5. Monitor for abuse
6. Keep dependencies updated

## Performance Tips

1. Cache API responses in KV
2. Use bot info caching to avoid `getMe` calls
3. Implement lazy loading for services
4. Use connection pooling where possible
5. Monitor and optimize slow queries
