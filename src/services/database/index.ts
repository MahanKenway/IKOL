// Database service with D1 batch operations and better error handling

import { getLogger } from '../logger/index.js';

const logger = getLogger({ module: 'database' });

const ALLOWED_COLUMNS = new Set([
  'username', 'first_name', 'last_name', 'language', 'is_admin', 'settings',
]);

export class DatabaseService {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async getUser(userId: number) {
    try {
      return await this.db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first() as any;
    } catch (error) {
      logger.warn('getUser failed', { userId, error: (error as Error).message });
      return null;
    }
  }

  async createUser(userId: number, username?: string, firstName?: string, lastName?: string) {
    const now = new Date().toISOString();
    try {
      await this.db.prepare(
        `INSERT OR IGNORE INTO users (id, username, first_name, last_name, language, created_at, last_active, settings)
         VALUES (?, ?, ?, ?, 'en', ?, ?, '{}')`
      ).bind(userId, username || null, firstName || null, lastName || null, now, now).run();
    } catch (error) {
      logger.warn('createUser failed', { userId, error: (error as Error).message });
    }
  }

  async updateUser(userId: number, data: Record<string, unknown>) {
    const keys = Object.keys(data).filter(k => ALLOWED_COLUMNS.has(k));
    if (keys.length === 0) return;
    const values = keys.map(k => data[k]);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    try {
      await this.db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).bind(...values, userId).run();
    } catch (error) {
      logger.warn('updateUser failed', { userId, error: (error as Error).message });
    }
  }

  async updateLastActive(userId: number) {
    try {
      await this.db.prepare('UPDATE users SET last_active = ? WHERE id = ?').bind(new Date().toISOString(), userId).run();
    } catch (error) {
      logger.warn('updateLastActive failed', { userId, error: (error as Error).message });
    }
  }

  async getConversationHistory(userId: number, limit = 20) {
    try {
      const r = await this.db.prepare(
        'SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at ASC LIMIT ?'
      ).bind(userId, limit).all();
      return r.results as any[];
    } catch (error) {
      logger.warn('getConversationHistory failed', { userId, error: (error as Error).message });
      return [];
    }
  }

  async addConversation(userId: number, role: string, content: string, provider?: string, model?: string) {
    try {
      await this.db.prepare(
        `INSERT INTO conversations (user_id, role, content, provider, model, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(userId, role, content, provider || null, model || null, new Date().toISOString()).run();
    } catch (error) {
      logger.warn('addConversation failed', { userId, error: (error as Error).message });
    }
  }

  async clearConversation(userId: number) {
    try {
      await this.db.prepare('DELETE FROM conversations WHERE user_id = ?').bind(userId).run();
    } catch (error) {
      logger.warn('clearConversation failed', { userId, error: (error as Error).message });
    }
  }

  async addDownload(userId: number, url: string, platform: string, filename?: string) {
    try {
      await this.db.prepare(
        `INSERT INTO downloads (user_id, url, platform, filename, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(userId, url, platform, filename || null, new Date().toISOString()).run();
    } catch (error) {
      logger.warn('addDownload failed', { userId, error: (error as Error).message });
    }
  }

  async trackApiUsage(userId: number, provider: string, model: string, tokens: number) {
    try {
      await this.db.prepare(
        `INSERT INTO api_usage (user_id, provider, model, tokens, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(userId, provider, model, tokens, new Date().toISOString()).run();
    } catch (error) {
      logger.warn('trackApiUsage failed', { userId, error: (error as Error).message });
    }
  }

  async getStats() {
    try {
      const [users, messages, downloads] = await this.db.batch([
        this.db.prepare('SELECT COUNT(*) as count FROM users'),
        this.db.prepare('SELECT COUNT(*) as count FROM conversations'),
        this.db.prepare('SELECT COUNT(*) as count FROM downloads'),
      ]);
      return {
        totalUsers: (users.results[0] as any)?.count || 0,
        totalMessages: (messages.results[0] as any)?.count || 0,
        totalDownloads: (downloads.results[0] as any)?.count || 0,
      };
    } catch (error) {
      logger.warn('getStats failed', { error: (error as Error).message });
      return { totalUsers: 0, totalMessages: 0, totalDownloads: 0 };
    }
  }

  async checkRateLimit(userId: number, action: string, limit: number, windowSeconds: number = 60) {
    const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();
    try {
      const result = await this.db.prepare(
        `SELECT COUNT(*) as count FROM rate_limits
         WHERE user_id = ? AND action = ? AND created_at > ?`
      ).bind(userId, action, windowStart).first();
      const count = (result as any)?.count || 0;
      if (count >= limit) return false;
      await this.db.prepare(
        'INSERT INTO rate_limits (user_id, action, created_at) VALUES (?, ?, ?)'
      ).bind(userId, action, new Date().toISOString()).run();
      return true;
    } catch {
      return true; // Fail open
    }
  }

  async cleanupRateLimits() {
    try {
      const cutoff = new Date(Date.now() - 3600_000).toISOString();
      await this.db.prepare('DELETE FROM rate_limits WHERE created_at < ?').bind(cutoff).run();
    } catch (error) {
      logger.warn('cleanupRateLimits failed', { error: (error as Error).message });
    }
  }
}
