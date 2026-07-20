// Cloudflare Environment Bindings for IKOL

export interface Env {
  // D1 Database
  DB: D1Database;

  // KV Storage
  KV: KVNamespace;

  // R2 Storage (optional)
  R2?: R2Bucket;

  // Environment
  ENVIRONMENT: string;

  // Bot tokens (secrets)
  TELEGRAM_BOT_TOKEN: string;
  BALE_BOT_TOKEN?: string;
  BOT_WEBHOOK_SECRET?: string;

  // AI Provider keys (secrets)
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  OPENROUTER_API_KEY?: string;

  // External API keys (secrets)
  NASA_API_KEY?: string;
  STEAM_API_KEY?: string;
  LASTFM_API_KEY?: string;

  // Feature flags
  ENABLE_AI?: string;
  ENABLE_DOWNLOADER?: string;
  ENABLE_MUSIC?: string;
}
