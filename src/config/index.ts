// Configuration constants (no environment dependencies)

export const CONFIG = {
  BOT_NAME: 'Ikol',
  BOT_NAME_FA: 'ایکول',
  VERSION: '1.0.0',

  MAX_MESSAGE_LENGTH: 4096,
  MAX_FILE_SIZE_MB: 50,

  CACHE_TTL: {
    SHORT: 300,
    MEDIUM: 1800,
    LONG: 3600,
    DAY: 86400,
  },

  APIS: {
    DEEZER: 'https://api.deezer.com',
    LASTFM: 'https://ws.audioscrobbler.com/2.0',
    MUSICBRAINZ: 'https://musicbrainz.org/ws/2',
    NASA: 'https://api.nasa.gov',
    SPACEX: 'https://api.spacexdata.com/v4',
    FRANKFURTER: 'https://api.frankfurter.app',
    METALS_LIVE: 'https://api.metals.live/v1',
    OPENAI: 'https://api.openai.com/v1',
    GEMINI: 'https://generativelanguage.googleapis.com/v1beta',
    ANTHROPIC: 'https://api.anthropic.com/v1',
    OPENROUTER: 'https://openrouter.ai/api/v1',
    COBALT: 'https://api.cobalt.tools',
    WIKIPEDIA: 'https://en.wikipedia.org/api/rest_v1',
  },

  LANGUAGES: { EN: 'en', FA: 'fa', AR: 'ar' },
  DEFAULT_LANGUAGE: 'en',
} as const;
