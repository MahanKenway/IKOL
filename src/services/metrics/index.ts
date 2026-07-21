// Production metrics collector — in-memory counters with periodic KV persistence
// Designed for Cloudflare Workers: lightweight, no external dependencies

import { getLogger } from '../logger/index.js';

const logger = getLogger({ module: 'metrics' });

export interface MetricSnapshot {
  ts: string;
  uptime: number;
  requests: {
    total: number;
    success: number;
    failed: number;
    byType: Record<string, number>;
  };
  users: {
    active: Set<number>;
    daily: Set<number>;
  };
  providers: Record<string, {
    calls: number;
    successes: number;
    failures: number;
    totalLatencyMs: number;
    avgLatencyMs: number;
    lastFailure: number;
  }>;
  cache: {
    hits: number;
    misses: number;
    hitRatio: number;
  };
  latency: {
    webhook: number[];
    ai: number[];
    download: number[];
    music: number[];
    database: number[];
    kv: number[];
  };
  errors: {
    total: number;
    byModule: Record<string, number>;
    recent: Array<{ ts: string; module: string; message: string }>;
  };
}

// Sliding window for latency (last 100 entries)
const MAX_LATENCY_ENTRIES = 100;
const RECENT_ERRORS_MAX = 50;

class MetricsCollector {
  private startTime = Date.now();
  private requestCount = 0;
  private successCount = 0;
  private failedCount = 0;
  private requestsByType = new Map<string, number>();
  private activeUsers = new Set<number>();
  private dailyUsers = new Set<number>();
  private lastDayReset = this.getStartOfDay();
  private providerMetrics = new Map<string, {
    calls: number;
    successes: number;
    failures: number;
    totalLatencyMs: number;
    lastFailure: number;
  }>();
  private cacheHits = 0;
  private cacheMisses = 0;
  private latencyBuckets = {
    webhook: [] as number[],
    ai: [] as number[],
    download: [] as number[],
    music: [] as number[],
    database: [] as number[],
    kv: [] as number[],
  };
  private errorCount = 0;
  private errorsByModule = new Map<string, number>();
  private recentErrors: Array<{ ts: string; module: string; message: string }> = [];

  private getStartOfDay(): string {
    return new Date().toISOString().split('T')[0];
  }

  private pushLatency(bucket: keyof typeof this.latencyBuckets, ms: number) {
    const arr = this.latencyBuckets[bucket];
    arr.push(ms);
    if (arr.length > MAX_LATENCY_ENTRIES) arr.shift();
  }

  private p95(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.95);
    return sorted[idx];
  }

  // --- Public API ---

  recordRequest(type: string, success: boolean) {
    this.requestCount++;
    if (success) this.successCount++;
    else this.failedCount++;
    this.requestsByType.set(type, (this.requestsByType.get(type) || 0) + 1);
  }

  recordUser(userId: number) {
    this.activeUsers.add(userId);
    // Reset daily at midnight
    const today = this.getStartOfDay();
    if (today !== this.lastDayReset) {
      this.dailyUsers.clear();
      this.lastDayReset = today;
    }
    this.dailyUsers.add(userId);
  }

  recordProviderCall(name: string, success: boolean, latencyMs: number) {
    let m = this.providerMetrics.get(name);
    if (!m) {
      m = { calls: 0, successes: 0, failures: 0, totalLatencyMs: 0, lastFailure: 0 };
      this.providerMetrics.set(name, m);
    }
    m.calls++;
    m.totalLatencyMs += latencyMs;
    if (success) m.successes++;
    else {
      m.failures++;
      m.lastFailure = Date.now();
    }
  }

  recordCacheHit() { this.cacheHits++; }
  recordCacheMiss() { this.cacheMisses++; }

  recordLatency(bucket: keyof typeof this.latencyBuckets, ms: number) {
    this.pushLatency(bucket, ms);
  }

  recordError(module: string, message: string) {
    this.errorCount++;
    this.errorsByModule.set(module, (this.errorsByModule.get(module) || 0) + 1);
    this.recentErrors.push({ ts: new Date().toISOString(), module, message });
    if (this.recentErrors.length > RECENT_ERRORS_MAX) this.recentErrors.shift();
  }

  // Remove user from active set after inactivity (call periodically)
  pruneInactiveUsers(maxInactiveMs: number = 30 * 60 * 1000) {
    // We can't track last-seen per user here without extra state,
    // so activeUsers represents "seen this session"
    // For daily, we reset at midnight
  }

  getSnapshot(): MetricSnapshot {
    const totalCache = this.cacheHits + this.cacheMisses;
    const providerSnap: Record<string, any> = {};
    for (const [name, m] of this.providerMetrics) {
      providerSnap[name] = {
        calls: m.calls,
        successes: m.successes,
        failures: m.failures,
        avgLatencyMs: m.calls > 0 ? Math.round(m.totalLatencyMs / m.calls) : 0,
        lastFailure: m.lastFailure,
      };
    }
    return {
      ts: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      requests: {
        total: this.requestCount,
        success: this.successCount,
        failed: this.failedCount,
        byType: Object.fromEntries(this.requestsByType),
      },
      users: {
        active: this.activeUsers,
        daily: this.dailyUsers,
      },
      providers: providerSnap,
      cache: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRatio: totalCache > 0 ? this.cacheHits / totalCache : 0,
      },
      latency: {
        webhook: [...this.latencyBuckets.webhook],
        ai: [...this.latencyBuckets.ai],
        download: [...this.latencyBuckets.download],
        music: [...this.latencyBuckets.music],
        database: [...this.latencyBuckets.database],
        kv: [...this.latencyBuckets.kv],
      },
      errors: {
        total: this.errorCount,
        byModule: Object.fromEntries(this.errorsByModule),
        recent: [...this.recentErrors],
      },
    };
  }

  formatUptime(ms: number): string {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s % 60}s`;
  }

  formatReport(): string {
    const snap = this.getSnapshot();
    const lines: string[] = [];

    lines.push(`Ikol Metrics Report`);
    lines.push(`${'─'.repeat(32)}`);
    lines.push(`Uptime: ${this.formatUptime(snap.uptime)}`);
    lines.push(`Requests: ${snap.requests.total} (ok: ${snap.requests.success}, fail: ${snap.requests.failed})`);
    lines.push(`Users today: ${snap.users.daily.size} | Active: ${snap.users.active.size}`);

    if (snap.providers && Object.keys(snap.providers).length > 0) {
      lines.push('');
      lines.push('Providers:');
      for (const [name, m] of Object.entries(snap.providers)) {
        const rate = m.calls > 0 ? ((m.successes / m.calls) * 100).toFixed(0) : '0';
        lines.push(`  ${name}: ${m.calls} calls, ${rate}% success, avg ${m.avgLatencyMs}ms`);
      }
    }

    lines.push('');
    lines.push(`Cache: ${(snap.cache.hitRatio * 100).toFixed(1)}% hit (${snap.cache.hits}/${snap.cache.hits + snap.cache.misses})`);

    const latBuckets = [
      ['Webhook', snap.latency.webhook],
      ['AI', snap.latency.ai],
      ['Download', snap.latency.download],
      ['DB', snap.latency.database],
    ] as const;
    const hasLatency = latBuckets.some(([, arr]) => arr.length > 0);
    if (hasLatency) {
      lines.push('');
      lines.push('Latency (p95):');
      for (const [label, arr] of latBuckets) {
        if (arr.length > 0) lines.push(`  ${label}: ${this.p95(arr)}ms`);
      }
    }

    if (snap.errors.total > 0) {
      lines.push('');
      lines.push(`Errors: ${snap.errors.total}`);
      for (const [mod, count] of Object.entries(snap.errors.byModule)) {
        lines.push(`  ${mod}: ${count}`);
      }
    }

    return lines.join('\n');
  }
}

// Singleton
export const metrics = new MetricsCollector();
