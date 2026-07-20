# Ikol Cloudflare Deployment Guide

Complete step-by-step guide to deploy Ikol on Cloudflare Workers.

## Table of Contents

1. [Cloudflare Account Setup](#1-cloudflare-account-setup)
2. [Project Preparation](#2-project-preparation)
3. [Cloudflare Workers Setup](#3-cloudflare-workers-setup)
4. [Database Setup (D1)](#4-database-setup-d1)
5. [Storage Setup (KV & R2)](#5-storage-setup-kv--r2)
6. [Environment Variables and Secrets](#6-environment-variables-and-secrets)
7. [GitHub Actions CI/CD](#7-github-actions-cicd)
8. [Telegram and Bale Webhook Setup](#8-telegram-and-bale-webhook-setup)
9. [Domain and Security](#9-domain-and-security)
10. [Monitoring](#10-monitoring)
11. [Production Checklist](#11-production-checklist)
12. [Recommended Architecture](#12-recommended-architecture)

---

## 1. Cloudflare Account Setup

### Step 1.1: Create Cloudflare Account

1. Go to https://dash.cloudflare.com/sign-up
2. Enter your email and password
3. Verify your email
4. Complete the account setup

### Step 1.2: Enable Workers

1. Log in to Cloudflare Dashboard
2. Go to **Workers & Pages** in the sidebar
3. Click **Get Started** if prompted
4. Workers free tier includes:
   - 100,000 requests/day
   - 10ms CPU time per request
   - 128MB memory

### Step 1.3: Create API Token

1. Go to **My Profile** → **API Tokens**
2. Click **Create Token**
3. Use the **Edit Cloudflare Workers** template
4. Configure permissions:

| Permission | Access Level |
|------------|--------------|
| Account - Workers Scripts | Edit |
| Account - D1 | Edit |
| Account - KV Storage | Edit |
| Account - R2 Storage | Edit |
| Account - Workers Runtimes | Edit |

5. Click **Continue to summary**
6. Click **Create Token**
7. **Copy and save the token** - you'll need it for Wrangler

### Step 1.4: Security Settings

- Enable **Two-Factor Authentication** (recommended)
- Set up **Account Lock** if needed
- Review **API Token permissions** regularly

---

## 2. Project Preparation

### Step 2.1: Install Required Packages

```bash
# Install Node.js dependencies
npm install

# Install Wrangler CLI globally
npm install -g wrangler

# Verify installation
wrangler --version
```

### Step 2.2: Login to Cloudflare

```bash
# Login with your API token
wrangler login

# Or set environment variable
export CLOUDFLARE_API_TOKEN=your_api_token_here
```

### Step 2.3: Verify Wrangler Configuration

The `wrangler.toml` file is already configured:

```toml
name = "ikol-bot"
main = "dist/index.js"
compatibility_date = "2024-04-01"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "production"

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "ikol-db"
database_id = "YOUR_DATABASE_ID_HERE"

# KV Storage
[[kv_namespaces]]
binding = "KV"
id = "YOUR_KV_NAMESPACE_ID_HERE"

# R2 Storage
[[r2_buckets]]
binding = "R2"
bucket_name = "ikol-media"
```

### Step 2.4: Required Environment Variables

Create a `.env` file (never commit this):

```env
# Cloudflare
CLOUDFLARE_API_TOKEN=your_api_token

# Bot Tokens
TELEGRAM_BOT_TOKEN=your_telegram_token
BALE_BOT_TOKEN=your_bale_token

# AI Provider (at least one)
OPENAI_API_KEY=your_openai_key
OPENROUTER_API_KEY=your_openrouter_key

# Optional APIs
NASA_API_KEY=your_nasa_key
```

---

## 3. Cloudflare Workers Setup

### Step 3.1: Create Worker

```bash
# Option 1: Create new Worker
wrangler create ikol-bot

# Option 2: Use existing wrangler.toml
# (Already configured in the project)
```

### Step 3.2: Build the Project

```bash
# Build TypeScript to JavaScript
npm run build

# This creates dist/index.js
```

### Step 3.3: Test Locally

```bash
# Start local development server
npm run dev

# Worker runs at http://localhost:8787
# Test health endpoint: http://localhost:8787/health
```

### Step 3.4: Deploy to Cloudflare

```bash
# Deploy to production
npm run deploy

# Or using wrangler directly
wrangler deploy
```

### Step 3.5: Verify Deployment

```bash
# Check Worker status
wrangler tail

# Test the deployed Worker
curl https://ikol-bot.your-subdomain.workers.dev/health
```

---

## 4. Database Setup (D1)

### Step 4.1: Create D1 Database

```bash
# Create database
wrangler d1 create ikol-db

# Output will show:
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
# Copy this ID!
```

### Step 4.2: Update wrangler.toml

Replace `YOUR_DATABASE_ID_HERE` with the actual ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "ikol-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### Step 4.3: Create Migrations

The migration file already exists at `migrations/0001_initial.sql`:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  language TEXT DEFAULT 'en',
  is_admin INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  last_active TEXT NOT NULL,
  settings TEXT DEFAULT '{}'
);

-- Conversation history
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Favorites
CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  data TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Download history
CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  platform TEXT NOT NULL,
  filename TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### Step 4.4: Apply Migrations

```bash
# Apply to local database (for testing)
npm run migrate:local

# Apply to production database
npm run migrate
```

### Step 4.5: Verify Database

```bash
# List tables
wrangler d1 execute ikol-db --command "SELECT name FROM sqlite_master WHERE type='table'"

# Check users table
wrangler d1 execute ikol-db --command "SELECT * FROM users LIMIT 5"
```

### Step 4.6: Database Backup Strategy

```bash
# Export database
wrangler d1 export ikol-db --output backup.sql

# Import database
wrangler d1 import ikol-db backup.sql
```

**Recommended:**
- Export daily backups
- Store backups in R2 or external storage
- Test restore process regularly

---

## 5. Storage Setup (KV & R2)

### Step 5.1: Create KV Namespace

```bash
# Create KV namespace
wrangler kv namespace create KV

# Output will show:
# id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
# Copy this ID!
```

### Step 5.2: Update wrangler.toml

Replace `YOUR_KV_NAMESPACE_ID_HERE`:

```toml
[[kv_namespaces]]
binding = "KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### Step 5.3: Create R2 Bucket

```bash
# Create R2 bucket
wrangler r2 bucket create ikol-media
```

### Step 5.4: What to Store in Each

| Service | Use For | Example |
|---------|---------|---------|
| **KV** | Bot info cache, user sessions, API responses | `bot_info`, `user:123:settings` |
| **R2** | Media files, downloads, thumbnails | Downloaded videos, images |

### Step 5.5: KV Usage in Code

```typescript
// Store data
await env.KV.put("bot_info", JSON.stringify(botInfo), { expirationTtl: 86400 });

// Retrieve data
const botInfo = await env.KV.get("bot_info");

// Delete data
await env.KV.delete("bot_info");

// List keys
const keys = await env.KV.list({ prefix: "user:" });
```

---

## 6. Environment Variables and Secrets

### Step 6.1: Add Secrets to Cloudflare

```bash
# Telegram Bot Token
wrangler secret put TELEGRAM_BOT_TOKEN
# Enter your token when prompted

# Bale Bot Token
wrangler secret put BALE_BOT_TOKEN
# Enter your token when prompted

# OpenAI API Key
wrangler secret put OPENAI_API_KEY
# Enter your key when prompted

# OpenRouter API Key
wrangler secret put OPENROUTER_API_KEY
# Enter your key when prompted

# NASA API Key (optional)
wrangler secret put NASA_API_KEY
# Enter your key when prompted
```

### Step 6.2: List Current Secrets

```bash
wrangler secret list
```

### Step 6.3: Delete a Secret

```bash
wrangler secret delete TELEGRAM_BOT_TOKEN
```

### Step 6.4: GitHub Secrets (for CI/CD)

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Click **New repository secret**
4. Add each secret:

| Name | Value |
|------|-------|
| `CLOUDFLARE_API_TOKEN` | Your Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare Account ID |
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token |
| `BALE_BOT_TOKEN` | Your Bale bot token |

### Step 6.5: Get Your Cloudflare Account ID

```bash
# Using Wrangler
wrangler whoami

# Or find it in Cloudflare Dashboard:
# Dashboard → URL bar shows: /accounts/XXXXXXXXXXXX/
# The XXXXXXXXXXXX is your Account ID
```

### Step 6.6: Security Rules

**NEVER:**
- Commit `.env` files to Git
- Hardcode secrets in source code
- Share secrets in chat or email
- Use production secrets in development

**ALWAYS:**
- Use Wrangler secrets for production
- Use `.dev.vars` for local development
- Rotate secrets regularly
- Use minimal permissions

---

## 7. GitHub Actions CI/CD

### Step 7.1: Create Workflow File

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy to Cloudflare Workers
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### Step 7.2: Push Workflow to GitHub

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add Cloudflare deployment workflow"
git push origin main
```

### Step 7.3: Verify Workflow

1. Go to GitHub repository → Actions tab
2. You should see the workflow running
3. Check for any errors

---

## 8. Telegram and Bale Webhook Setup

### Step 8.1: Set Telegram Webhook

```bash
# Set webhook using curl
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://ikol-bot.your-subdomain.workers.dev/"}'

# Or using the Bot API directly
# Replace YOUR_TOKEN with your actual bot token
# Replace the URL with your Worker's URL
```

### Step 8.2: Set Bale Webhook

```bash
# Set Bale webhook
curl -X POST "https://tapi.bale.ai/bot<YOUR_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://ikol-bot.your-subdomain.workers.dev/"}'
```

### Step 8.3: Verify Webhook

```bash
# Check Telegram webhook status
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo"

# Check Bale webhook status
curl "https://tapi.bale.ai/bot<YOUR_TOKEN>/getWebhookInfo"
```

### Step 8.4: Test the Bot

1. Open Telegram/Bale
2. Find your bot by username
3. Send `/start`
4. You should receive a response

### Step 8.5: Debug Failed Requests

```bash
# View Worker logs
wrangler tail

# Check for errors in the response
# Common issues:
# - Invalid token
# - Worker URL incorrect
# - Secrets not configured
```

### Step 8.6: Production Error Handling

The Worker includes error handling:

```typescript
// In src/index.ts
try {
  // Process update
} catch (error) {
  console.error('Bot error:', error);
  return new Response('Internal server error', { status: 500 });
}
```

---

## 9. Domain and Security

### Step 9.1: Custom Domain (Optional)

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your Worker
3. Go to **Settings** → **Triggers**
4. Click **Add Custom Domain**
5. Enter your domain (e.g., `bot.yourdomain.com`)
6. Follow the DNS configuration steps

### Step 9.2: HTTPS

Cloudflare Workers automatically provide HTTPS:
- Default URL: `https://ikol-bot.your-subdomain.workers.dev`
- Custom domain: `https://bot.yourdomain.com`

### Step 9.3: Firewall Rules

Create firewall rules in Cloudflare Dashboard:

1. Go to **Security** → **WAF**
2. Create rules to:
   - Block suspicious IPs
   - Rate limit by IP
   - Protect against abuse

### Step 9.4: Rate Limiting

Add rate limiting in your Worker code:

```typescript
// Simple rate limiting using KV
async function checkRateLimit(env: Env, userId: number): Promise<boolean> {
  const key = `rate:${userId}`;
  const count = await env.KV.get(key);
  
  if (count && parseInt(count) >= 30) {
    return false; // Rate limited
  }
  
  await env.KV.put(key, count ? String(parseInt(count) + 1) : "1", {
    expirationTtl: 60, // 1 minute window
  });
  
  return true;
}
```

### Step 9.5: Bot Protection

- Use `BOT_WEBHOOK_SECRET` to verify webhook requests
- Implement CAPTCHA for sensitive operations
- Log all admin actions

---

## 10. Monitoring

### Step 10.1: View Logs

```bash
# Stream live logs
wrangler tail

# View logs for specific Worker
wrangler tail --name ikol-bot
```

### Step 10.2: Worker Analytics

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your Worker
3. View **Metrics** tab:
   - Request count
   - Response time
   - Error rate
   - CPU usage

### Step 10.3: Error Monitoring

Add error tracking in your code:

```typescript
// Log errors to console (visible in wrangler tail)
console.error('Error:', error);

// Or send to external service (Sentry, etc.)
```

### Step 10.4: API Failure Monitoring

Monitor external API calls:

```typescript
// In your API client
try {
  const response = await fetch(apiUrl);
  if (!response.ok) {
    console.error(`API error: ${response.status}`);
  }
} catch (error) {
  console.error('API connection failed:', error);
}
```

### Step 10.5: Performance Monitoring

- Monitor Worker execution time
- Track API response times
- Set up alerts for slow responses

---

## 11. Production Checklist

### Pre-Launch Checklist

```
[ ] Cloudflare account created
[ ] API token with correct permissions
[ ] Worker deployed successfully
[ ] D1 database created and migrated
[ ] KV namespace created
[ ] R2 bucket created (if needed)
[ ] All secrets configured in Cloudflare
[ ] GitHub secrets configured
[ ] Telegram webhook set and verified
[ ] Bale webhook set and verified
[ ] Bot responds to /start command
[ ] All commands working (/help, /run, /time, /date, /calc)
[ ] AI provider working (OpenAI/OpenRouter)
[ ] Persian language support working
[ ] Jalali calendar displaying correctly
[ ] Error handling in place
[ ] Logging configured
[ ] Rate limiting implemented
[ ] Custom domain configured (if needed)
[ ] HTTPS working
[ ] Backup strategy in place
```

### Post-Launch Checklist

```
[ ] Monitor logs for first 24 hours
[ ] Check error rates
[ ] Verify webhook delivery
[ ] Test all features
[ ] Document any issues
[ ] Set up alerts for failures
[ ] Schedule regular backups
[ ] Review security settings
```

---

## 12. Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Repository                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Source Code: src/                                   │   │
│  │  Tests: tests/                                       │   │
│  │  Config: wrangler.toml, package.json                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 GitHub Actions CI/CD                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  1. Test (npm test)                                 │   │
│  │  2. Build (npm run build)                           │   │
│  │  3. Deploy (wrangler deploy)                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Workers (Edge)                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Worker: ikol-bot                                    │   │
│  │  Runtime: Node.js compatible                         │   │
│  │  Framework: grammY                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│         ┌──────────────────┼──────────────────┐            │
│         ▼                  ▼                  ▼            │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐        │
│  │   D1     │      │   KV     │      │   R2     │        │
│  │ Database │      │  Cache   │      │ Storage  │        │
│  │          │      │          │      │          │        │
│  │ - Users  │      │ - Bot    │      │ - Media  │        │
│  │ - History│      │   info   │      │ - Files  │        │
│  │ - Skills │      │ - Sessions│     │ - Downloads│       │
│  └──────────┘      └──────────┘      └──────────┘        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    External APIs                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Telegram │  │   Bale   │  │  OpenAI  │  │   NASA   │  │
│  │   API    │  │   API    │  │   API    │  │   API    │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Message (Telegram/Bale)
    │
    ▼
Telegram/Bale API
    │
    ▼
Cloudflare Worker
    │
    ├──► KV Cache (check for cached bot info)
    │
    ├──► D1 Database (load user data, save conversation)
    │
    ├──► Bot Logic (process command)
    │
    ├──► External APIs (if needed)
    │
    └──► Response to User
```

### Cost Estimation

| Service | Free Tier | Paid Tier |
|---------|-----------|-----------|
| **Workers** | 100K requests/day | $5/mo for 10M requests |
| **D1** | 5GB storage, 100K reads/day | $0.75/GB stored |
| **KV** | 1GB storage, 100K reads/day | $0.50/GB stored |
| **R2** | 10GB storage, 10M reads/month | $0.015/GB stored |

**Estimated Monthly Cost:**
- Low usage (<10K requests/day): **Free**
- Medium usage (10K-100K requests/day): **$5-10**
- High usage (>100K requests/day): **$10-50**

---

## Quick Reference Commands

```bash
# Development
npm run dev                    # Start local server
npm run build                  # Build project
npm test                       # Run tests

# Deployment
npm run deploy                 # Deploy to production
wrangler tail                  # View logs
wrangler secret list           # List secrets

# Database
npm run migrate                # Apply migrations
npm run migrate:local          # Apply to local DB

# Troubleshooting
wrangler tail                  # Stream logs
wrangler d1 execute ikol-db --command "SELECT * FROM users"
curl https://your-worker.workers.dev/health
```

---

## Support

- Cloudflare Workers Docs: https://developers.cloudflare.com/workers/
- D1 Docs: https://developers.cloudflare.com/d1/
- KV Docs: https://developers.cloudflare.com/kv/
- R2 Docs: https://developers.cloudflare.com/r2/
- grammY Docs: https://grammy.dev/

---

*Last updated: July 2026*
