export interface Env {
  DB: D1Database;
  KV: KVNamespace;

  ENVIRONMENT: string;
  BOT_TOKEN: string;
  BOT_WEBHOOK_SECRET: string;

  // AI
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  OPENROUTER_API_KEY?: string;

  // Cloudflare Workers AI
  AI?: Ai;

  // Music
  SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;
  LASTFM_API_KEY?: string;
  GENIUS_API_KEY?: string;
  MUSIXMATCH_API_KEY?: string;

  // Download
  COBALT_API_URL?: string;
  COBALT_API_KEY?: string;

  // Finance
  EXCHANGERATE_API_KEY?: string;

  // Space
  NASA_API_KEY?: string;

  // Gaming
  STEAM_API_KEY?: string;

  // Image Search - Pinterest
  PINTEREST_ENABLED?: string;
  PINTEREST_CLIENT_ID?: string;
  PINTEREST_CLIENT_SECRET?: string;
  PINTEREST_ACCESS_TOKEN?: string;
  PINTEREST_API_URL?: string;
  PINTEREST_PROVIDER?: string;
  PINTEREST_FALLBACK_ENABLED?: string;

  // Image Search - Other providers
  PEXELS_API_KEY?: string;
  PIXABAY_API_KEY?: string;
  UNSPLASH_ACCESS_KEY?: string;

  // Logging
  LOG_LEVEL?: string;

  // Feature flags
  ENABLE_AI?: string;
  ENABLE_DOWNLOADER?: string;
  ENABLE_MUSIC?: string;
  ENABLE_FINANCE?: string;
  ENABLE_SPACE?: string;
  ENABLE_GAMES?: string;
  ENABLE_UTILITIES?: string;
  ENABLE_FUN_CALENDAR?: string;
  ENABLE_IMAGE_SEARCH?: string;

  // Provider config
  AI_PRIMARY_PROVIDER?: string;
  AI_FALLBACK_ENABLED?: string;
  RATE_LIMIT_ENABLED?: string;
  WEBHOOK_AUTO_SET?: string;

  // Admin
  OWNER_IDS?: string;
}
