# Ikol Bot - Architecture

## Overview

Ikol is a modular Telegram bot built on Cloudflare Workers with grammY. It uses a plugin-based architecture where features are self-registering modules.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                  Cloudflare Worker                   │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Webhook  │  │ Startup  │  │     Metrics      │  │
│  │ Handler  │  │  Verify  │  │   Collector      │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │              │                 │             │
│  ┌────▼──────────────▼─────────────────▼─────────┐  │
│  │              Bot Instance (grammY)             │  │
│  │  ┌──────────────────────────────────────────┐  │  │
│  │  │           Middleware Stack                │  │  │
│  │  │  error → logging → env → services →      │  │  │
│  │  │  user → rateLimit → language              │  │  │
│  │  └──────────────────────────────────────────┘  │  │
│  │                                                │  │
│  │  ┌──────────────────────────────────────────┐  │  │
│  │  │         Plugin System (Auto-Discovery)   │  │  │
│  │  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │  │  │
│  │  │  │  AI │ │Downl│ │Music│ │Finan│ ...     │  │  │
│  │  │  │     │ │oader│ │     │ │ce   │         │  │  │
│  │  │  └─────┘ └─────┘ └─────┘ └─────┘       │  │  │
│  │  └──────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────┘  │
│                                                     │
│  ┌────────────────────────────────────────────────┐  │
│  │              Services Layer                     │  │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │  │
│  │  │ Cache  │ │  DB    │ │Logger  │ │Metrics │  │  │
│  │  │(Tiered)│ │ (D1)   │ │(JSON)  │ │        │  │  │
│  │  └────────┘ └────────┘ └────────┘ └────────┘  │  │
│  │  ┌────────┐ ┌────────┐ ┌────────┐             │  │
│  │  │Circuit │ │Feature │ │Startup │             │  │
│  │  │Breaker │ │ Flags  │ │Verify  │             │  │
│  │  └────────┘ └────────┘ └────────┘             │  │
│  └────────────────────────────────────────────────┘  │
│                                                     │
│  ┌────────────────────────────────────────────────┐  │
│  │           Provider Layer (MultiProvider)        │  │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │  │
│  │  │  AI    │ │ Music  │ │Finance │ │Download│  │  │
│  │  │Providers│ │Providers│ │Providers│ │Providers│  │  │
│  │  └────────┘ └────────┘ └────────┘ └────────┘  │  │
│  └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
         │                    │
    ┌────▼────┐          ┌────▼────┐
    │   D1    │          │   KV    │
    │(SQLite) │          │(Cache)  │
    └─────────┘          └─────────┘
```

## Key Components

### Plugin System (`src/bot/plugin-system.ts`)

Modules self-register at import time:

```typescript
// In any module file
registerModule({
  name: 'my-module',
  featureFlag: 'ai',      // feature flag that controls this module
  version: '1.0.0',
  register(composer, env, flags) {
    composer.command('mycommand', async (ctx) => { ... });
  },
});
```

The bot automatically discovers and loads all registered modules via `loadModules()`.

### Middleware Stack

1. **errorMiddleware** — Catches all errors, sends user-friendly message
2. **loggingMiddleware** — Logs slow updates (>5s)
3. **envMiddleware** — Injects environment variables
4. **servicesMiddleware** — Initializes DB, Cache, RateLimiter
5. **userMiddleware** — Loads/creates user, sets language, generates requestId
6. **rateLimitMiddleware** — KV-based rate limiting (optional)
7. **languageMiddleware** — Fallback language detection

### MultiProvider System

Each domain (AI, Music, Finance, Download, Lyrics) uses `MultiProvider<T>`:

- Providers sorted by priority (lower = tried first)
- Circuit breaker integration (auto-disable failing providers)
- Latency and success rate tracking
- Automatic fallback on failure

### Tiered Cache

L1 (in-memory) → L2 (KV) with per-feature TTL policies:

| Feature | L1 TTL | L2 TTL |
|---------|--------|--------|
| AI Response | 30s | 5min |
| Weather | 5min | 15min |
| Currency | 5min | 30min |
| NASA | 1hr | 24hr |
| Lyrics | 1hr | 24hr |
| Music | 30min | 6hr |
| Facts | 24hr | 7 days |

### Circuit Breaker

States: `closed` → `open` → `half-open`

- **Closed**: Normal operation, counting failures
- **Open**: Provider disabled, reject all calls
- **Half-Open**: After cooldown, allow limited test calls
- State persisted in KV for cross-worker consistency

### Metrics Collector

In-memory counters with periodic reporting:

- Request counts by type
- Provider success rates and latency
- Cache hit ratios
- Error tracking with recent error log
- User activity (daily, active)

### Structured Logger

JSON-formatted logs with context:

```json
{
  "ts": "2026-07-21T04:00:00.000Z",
  "level": "info",
  "msg": "Update processed",
  "ctx": {
    "requestId": "req_abc123",
    "updateId": 12345,
    "userId": 67890,
    "latency": 150,
    "status": "success"
  }
}
```

## Data Flow

```
Telegram → Webhook → Worker → Middleware → Module → Provider → External API
                                    ↓
                              D1 (users, conversations, downloads)
                                    ↓
                              KV (cache, rate limits, circuit breaker)
```

## File Structure

```
src/
├── index.ts                    # Worker entry point
├── bot/
│   ├── index.ts                # Bot creation and module loading
│   ├── plugin-system.ts        # Plugin registration and discovery
│   ├── commands/basic.ts       # /start, /help, /settings, /stats
│   └── middleware/index.ts     # All middleware
├── modules/
│   ├── ai/enhanced.ts          # AI chat with streaming
│   ├── admin/index.ts          # Owner-only commands
│   ├── downloader/enhanced.ts  # Media downloads
│   ├── music/enhanced.ts       # Music search + lyrics
│   ├── finance/index.ts        # Currency, gold, crypto
│   ├── space/index.ts          # NASA, SpaceX, Mars
│   ├── games/index.ts          # Free games
│   ├── fun-calendar/index.ts   # Fun days, facts, quotes
│   └── utilities/index.ts      # Weather, QR, translate, wiki
├── services/
│   ├── cache/
│   │   ├── tiered.ts           # L1/L2 cache
│   │   ├── policies.ts         # Per-feature TTL policies
│   │   └── index.ts            # Simple KV cache
│   ├── database/index.ts       # D1 operations
│   ├── logger/index.ts         # Structured JSON logger
│   ├── metrics/index.ts        # Production metrics
│   ├── circuit-breaker/index.ts # KV-backed circuit breaker
│   ├── feature-flags/index.ts  # Runtime feature toggles
│   ├── startup/index.ts        # Startup verification
│   ├── rate-limiter/index.ts   # KV-based rate limiting
│   └── providers/
│       ├── index.ts            # MultiProvider base
│       ├── music.ts            # Deezer, Spotify, iTunes, MusicBrainz
│       ├── lyrics.ts           # LRCLIB, Genius, Musixmatch
│       ├── finance.ts          # Frankfurter, CoinGecko, CoinCap
│       └── downloader.ts       # Cobalt, Direct Extraction
├── config/index.ts             # Constants
├── types/
│   ├── env.ts                  # Environment variables
│   └── index.ts                # Type exports
└── utils/helpers.ts            # URL detection, formatting
```

## Adding a New Module

1. Create `src/modules/my-feature/index.ts`:

```typescript
import { Composer, type Context } from 'grammy';
import type { Env } from '../../types/env.js';
import type { FeatureFlags } from '../../services/feature-flags/index.js';
import type { IkolModule } from '../../bot/plugin-system.js';
import { registerModule } from '../../bot/plugin-system.js';

function createMyFeatureModule(): IkolModule {
  return {
    name: 'my-feature',
    featureFlag: 'ai',  // reuse existing flag or add new one
    version: '1.0.0',
    register(composer: Composer<Context>, env: Env, flags: FeatureFlags) {
      composer.command('mycommand', async (ctx) => {
        await ctx.reply('Hello from my feature!');
      });
    },
  };
}

registerModule(createMyFeatureModule());
```

2. Add import in `src/bot/index.ts`:
```typescript
import '../modules/my-feature/index.js';
```

That's it. No other files need to change.
