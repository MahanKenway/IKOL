# Ikol Bot - Production Release Checklist

## Pre-Deployment

### Code Quality
- [ ] `npm run typecheck` — 0 errors
- [ ] `npm test` — all tests pass (57+ tests)
- [ ] `npm run build` — clean build
- [ ] No console.log statements in production code (use logger)
- [ ] No hardcoded secrets or API keys
- [ ] All TODOs resolved or documented

### Security
- [ ] BOT_TOKEN set as Cloudflare secret
- [ ] BOT_WEBHOOK_SECRET set as Cloudflare secret
- [ ] Gemini API key passed via header, not URL
- [ ] Timing-safe webhook verification enabled
- [ ] Content-Type validation on webhook endpoint
- [ ] Rate limiting enabled (RATE_LIMIT_ENABLED=true)
- [ ] Owner IDs configured (OWNER_IDS=telegram_user_id)

### Configuration
- [ ] wrangler.toml has correct database_id
- [ ] wrangler.toml has correct KV namespace id
- [ ] Feature flags reviewed and set appropriately
- [ ] AI_PRIMARY_PROVIDER set (default: gemini)
- [ ] LOG_LEVEL set (default: info)

### Database
- [ ] Migrations applied: `npm run migrate`
- [ ] D1 database created and bound
- [ ] KV namespace created and bound

## Deployment

### Step 1: Set Secrets
```bash
npx wrangler secret put BOT_TOKEN
npx wrangler secret put BOT_WEBHOOK_SECRET
npx wrangler secret put GEMINI_API_KEY        # optional
npx wrangler secret put OPENAI_API_KEY        # optional
npx wrangler secret put OPENROUTER_API_KEY    # optional
npx wrangler secret put OWNER_IDS             # your Telegram user ID
```

### Step 2: Run Migrations
```bash
npm run migrate
```

### Step 3: Deploy
```bash
npm run deploy
```

### Step 4: Set Webhook
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://<your-worker>.workers.dev/", "secret_token": "<SECRET>"}'
```

### Step 5: Verify
```bash
# Health check
curl https://<your-worker>.workers.dev/health

# Metrics
curl https://<your-worker>.workers.dev/metrics
```

## Post-Deployment

### Immediate (first 5 minutes)
- [ ] Health endpoint returns `{"status":"ok"}`
- [ ] Test /start command in Telegram
- [ ] Test /ai command
- [ ] Test /help command
- [ ] Check worker logs for errors

### Short-term (first hour)
- [ ] Monitor error rates
- [ ] Check provider health via /providers
- [ ] Verify rate limiting works
- [ ] Test callback buttons

### Ongoing
- [ ] Monitor /stats periodically
- [ ] Check /errors for new issues
- [ ] Review provider success rates
- [ ] Monitor cache hit ratio

## Rollback Plan

If critical issues arise:

1. Disable webhook:
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
```

2. Revert to previous deployment:
```bash
npx wrangler rollback
```

3. Re-enable webhook after fix

## Feature Flags Quick Reference

| Flag | Default | Description |
|------|---------|-------------|
| ENABLE_AI | true | AI chat functionality |
| ENABLE_DOWNLOADER | true | Media downloads |
| ENABLE_MUSIC | true | Music search |
| ENABLE_FINANCE | true | Currency, gold, crypto |
| ENABLE_SPACE | true | NASA, SpaceX, Mars |
| ENABLE_GAMES | true | Free games |
| ENABLE_UTILITIES | true | Weather, QR, translate |
| ENABLE_FUN_CALENDAR | true | Fun days, facts, quotes |
| RATE_LIMIT_ENABLED | true | Rate limiting |
| AI_FALLBACK_ENABLED | true | AI provider fallback |

## Monitoring Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with startup verification |
| `/metrics` | GET | Production metrics JSON |
| `/` | GET | Basic status |

## Admin Commands (Owner Only)

| Command | Description |
|---------|-------------|
| `/health` | Quick health check |
| `/stats` | Detailed statistics |
| `/providers` | Provider health status |
| `/cache` | Cache statistics and policies |
| `/errors` | Recent errors |
| `/runtime` | Runtime info and feature flags |
| `/metrics` | Raw metrics JSON |
| `/modules` | List loaded modules |
