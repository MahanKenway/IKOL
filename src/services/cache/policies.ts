// Per-feature cache policies — different TTLs for different data types
// Never use one global TTL again

export interface CachePolicy {
  /** L1 in-memory TTL (ms) */
  l1TTL: number;
  /** L2 KV TTL (seconds) */
  l2TTL: number;
  /** Human-readable name */
  name: string;
}

// Cache policy registry
const POLICIES: Record<string, CachePolicy> = {
  // AI responses — short TTL, content changes frequently
  ai: { name: 'AI Response', l1TTL: 30_000, l2TTL: 300 },        // 30s L1, 5min L2

  // Weather — moderate TTL, updates every 15 min
  weather: { name: 'Weather', l1TTL: 300_000, l2TTL: 900 },      // 5min L1, 15min L2

  // Currency — moderate TTL, rates update hourly
  currency: { name: 'Currency', l1TTL: 300_000, l2TTL: 1800 },   // 5min L1, 30min L2

  // Gold — same as currency
  gold: { name: 'Gold', l1TTL: 300_000, l2TTL: 1800 },           // 5min L1, 30min L2

  // Crypto — short TTL, prices change fast
  crypto: { name: 'Crypto', l1TTL: 60_000, l2TTL: 300 },         // 1min L1, 5min L2

  // NASA APOD — changes once daily
  nasa: { name: 'NASA', l1TTL: 3_600_000, l2TTL: 86400 },        // 1hr L1, 24hr L2

  // SpaceX — changes rarely
  spacex: { name: 'SpaceX', l1TTL: 3_600_000, l2TTL: 3600 },    // 1hr L1, 1hr L2

  // Mars photos — change rarely
  mars: { name: 'Mars', l1TTL: 3_600_000, l2TTL: 86400 },       // 1hr L1, 24hr L2

  // Lyrics — static once found
  lyrics: { name: 'Lyrics', l1TTL: 3_600_000, l2TTL: 86400 },   // 1hr L1, 24hr L2

  // Music metadata — changes infrequently
  music: { name: 'Music', l1TTL: 1_800_000, l2TTL: 21600 },     // 30min L1, 6hr L2

  // Fun facts / quotes — static content
  facts: { name: 'Facts', l1TTL: 86_400_000, l2TTL: 604800 },   // 24hr L1, 7 days L2

  // Free games — changes daily
  games: { name: 'Games', l1TTL: 3_600_000, l2TTL: 3600 },      // 1hr L1, 1hr L2

  // Wikipedia — changes infrequently
  wiki: { name: 'Wikipedia', l1TTL: 3_600_000, l2TTL: 86400 },   // 1hr L1, 24hr L2

  // Translation — moderate TTL
  translate: { name: 'Translate', l1TTL: 300_000, l2TTL: 1800 }, // 5min L1, 30min L2

  // Bot info — changes rarely
  botInfo: { name: 'Bot Info', l1TTL: 3_600_000, l2TTL: 86400 }, // 1hr L1, 24hr L2

  // User settings — changes rarely
  userSettings: { name: 'User Settings', l1TTL: 300_000, l2TTL: 3600 }, // 5min L1, 1hr L2

  // Default — conservative
  default: { name: 'Default', l1TTL: 60_000, l2TTL: 300 },      // 1min L1, 5min L2
};

export function getCachePolicy(feature: string): CachePolicy {
  return POLICIES[feature] || POLICIES.default;
}

export function getAllPolicies(): Readonly<Record<string, CachePolicy>> {
  return POLICIES;
}
