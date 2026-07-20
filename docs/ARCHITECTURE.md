# Ikol Bot Architecture

## Overview

Ikol is built as a modular Telegram bot using the grammY framework, designed for deployment on Cloudflare Workers.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Telegram Bot API                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Cloudflare Worker                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    grammY Bot                        │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │              Middleware Stack                 │   │   │
│  │  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │   │   │
│  │  │  │Error │ │Logger│ │ Rate │ │User  │       │   │   │
│  │  │  │Handle│ │      │ │Limit │ │Info  │       │   │   │
│  │  │  └──────┘ └──────┘ └──────┘ └──────┘       │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │                         │                          │   │
│  │                         ▼                          │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │              Module Router                   │   │   │
│  │  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │   │   │
│  │  │  │ AI  │ │Down │ │Music│ │Fin  │ │Space│  │   │   │
│  │  │  │     │ │load │ │     │ │ance │ │     │  │   │   │
│  │  │  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘  │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                              │
│                              ▼                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                Service Layer                        │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │   │
│  │  │Database │ │ Cache   │ │   API   │ │ Logger  │  │   │
│  │  │  (D1)   │ │  (KV)   │ │ Client  │ │         │  │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Cloudflare Services                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │   D1    │ │   KV    │ │   R2    │ │Queues   │          │
│  │Database │ │ Storage │ │ Storage │ │(Future) │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 External APIs                                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │  AI     │ │ Music   │ │ Space   │ │ Finance │          │
│  │Providers│ │  APIs   │ │  APIs   │ │  APIs   │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## Design Principles

### 1. Modular Architecture
Each feature is an independent module with its own:
- Command handlers
- Callback query handlers
- Business logic
- API integrations

### 2. Service Layer
Core services are separated from business logic:
- **DatabaseService** - D1 operations
- **CacheService** - KV caching
- **ApiClient** - HTTP requests with retry
- **Logger** - Structured logging

### 3. Middleware Pipeline
Request processing follows a defined pipeline:
1. Logging
2. Services initialization
3. User info extraction
4. Rate limiting
5. Error handling
6. Language detection

### 4. Type Safety
Strong TypeScript typing throughout:
- Environment bindings
- API responses
- Database models
- Bot context

## Data Flow

```
User Message
    │
    ▼
Telegram API ──► Webhook ──► Cloudflare Worker
    │
    ▼
grammY Bot
    │
    ▼
Middleware Stack
    │
    ├──► Logging
    ├──► Services (DB, Cache, API)
    ├──► User Info
    ├──► Rate Limit
    ├──► Error Handling
    │
    ▼
Module Router
    │
    ├──► AI Module
    ├──► Downloader Module
    ├──► Music Module
    ├──► Finance Module
    ├──► Space Module
    ├──► Games Module
    ├──► Fun Calendar Module
    └──► Utilities Module
            │
            ▼
        Response ──► Telegram API ──► User
```

## Database Schema

### Users
Stores user profiles and settings.

### Conversations
AI chat history for context management.

### API Usage
Tracks API calls for rate limiting and analytics.

### Favorites
User-saved items (songs, games, etc.).

### Downloads
Download history for analytics.

### Rate Limits
Rate limiting counters per user/action.

## Caching Strategy

### KV Cache Layers
1. **Bot Info** - 24h TTL
2. **API Responses** - 5min to 1h TTL
3. **User Sessions** - 30min TTL
4. **Rate Limits** - 1min window

### Cache Invalidation
- Time-based expiration
- Pattern-based deletion
- Manual invalidation on updates

## Error Handling

### Error Boundaries
Each module has isolated error handling:
- Module errors don't crash the bot
- User-friendly error messages
- Detailed logging for debugging

### Retry Logic
API clients implement exponential backoff:
- 3 retries by default
- 1s, 2s, 4s delays
- Timeout handling

## Security

### Rate Limiting
- Global: 30 requests/minute
- AI: 10 requests/minute
- Downloads: 5 requests/minute

### Input Validation
- URL validation
- Command parameter sanitization
- SQL injection prevention (parameterized queries)

### Secret Management
- Cloudflare Secrets for production
- `.dev.vars` for development
- Never hardcoded

## Performance Optimization

### Cold Start
- Bot info cached in KV
- Lazy service initialization
- Minimal dependencies

### Request Processing
- Fast middleware pipeline
- Early returns for invalid requests
- Parallel API calls where possible

### Memory Management
- No persistent state in Worker
- Stateless design
- Ephemeral file handling

## Deployment Architecture

### Staging
- Automatic deployment from `develop` branch
- Separate D1 database
- Testing environment

### Production
- Manual approval required
- Optimized build
- Monitoring enabled

## Monitoring

### Metrics
- Request count
- Response time
- Error rate
- API usage per user

### Logging
- Structured JSON logs
- Level-based filtering
- Context enrichment

## Future Enhancements

### Short Term
- Inline query support
- Group chat features
- Admin commands

### Medium Term
- Custom plugin system
- Web dashboard
- Analytics API

### Long Term
- Multi-bot support
- Self-hosted AI models
- Advanced caching strategies
