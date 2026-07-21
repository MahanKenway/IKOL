// Configuration constants
export const CONFIG = {
  // Bot info
  BOT_NAME: 'Ikol',
  BOT_NAME_FA: 'ایکول',
  BOT_DESCRIPTION: 'Intelligent Telegram AI Assistant',

  // Version
  VERSION: '2.0.0',

  // Limits
  MAX_MESSAGE_LENGTH: 4096,
  MAX_FILE_SIZE_MB: 50,
  MAX_DOWNLOAD_SIZE_MB: 200,

  // Rate limiting
  DEFAULT_RATE_LIMIT: 30, // requests per minute
  AI_RATE_LIMIT: 10,
  DOWNLOAD_RATE_LIMIT: 5,

  // Cache TTLs (in seconds)
  CACHE_TTL: {
    SHORT: 300,      // 5 minutes
    MEDIUM: 1800,    // 30 minutes
    LONG: 3600,      // 1 hour
    DAY: 86400,      // 24 hours
    WEEK: 604800,    // 7 days
  },

  // API Endpoints
  APIS: {
    // Music
    DEEZER: 'https://api.deezer.com',
    LASTFM: 'https://ws.audioscrobbler.com/2.0',
    MUSICBRAINZ: 'https://musicbrainz.org/ws/2',

    // Space
    NASA: 'https://api.nasa.gov',
    SPACEX: 'https://api.spacexdata.com/v4',

    // Finance
    FRANKFURTER: 'https://api.frankfurter.app',
    METALS_LIVE: 'https://api.metals.live/v1',

    // Gaming
    EPIC_GAMES: 'https://graphql.epicgames.com/graphql',

    // AI
    OPENAI: 'https://api.openai.com/v1',
    GEMINI: 'https://generativelanguage.googleapis.com/v1beta',
    ANTHROPIC: 'https://api.anthropic.com/v1',
    OPENROUTER: 'https://openrouter.ai/api/v1',

    // Download
    COBALT: 'https://api.cobalt.tools',

    // Wikipedia
    WIKIPEDIA: 'https://en.wikipedia.org/api/rest_v1',

    // Image Search
    PINTEREST: 'https://www.pinterest.com',
    PEXELS: 'https://api.pexels.com',
    PIXABAY: 'https://pixabay.com/api',
    UNSPLASH: 'https://api.unsplash.com',
    WIKIMEDIA_COMMONS: 'https://commons.wikimedia.org/w/api.php',
  },

  // Supported languages
  LANGUAGES: {
    EN: 'en',
    FA: 'fa', // Persian/Farsi
  },

  // Default language
  DEFAULT_LANGUAGE: 'en',
} as const;
