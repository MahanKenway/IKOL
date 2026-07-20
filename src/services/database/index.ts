import type { Env } from '../types/env.js';

export class DatabaseService {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  // User operations
  async getUser(userId: number) {
    const result = await this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(userId)
      .first();
    return result as any;
  }

  async createUser(userId: number, username?: string, firstName?: string, lastName?: string) {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT OR IGNORE INTO users (id, username, first_name, last_name, language, created_at, last_active, settings)
         VALUES (?, ?, ?, ?, 'en', ?, ?, '{}')`
      )
      .bind(userId, username || null, firstName || null, lastName || null, now, now)
      .run();
  }

  async updateUser(userId: number, data: Record<string, unknown>) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    
    await this.db
      .prepare(`UPDATE users SET ${setClause} WHERE id = ?`)
      .bind(...values, userId)
      .run();
  }

  async updateLastActive(userId: number) {
    await this.db
      .prepare('UPDATE users SET last_active = ? WHERE id = ?')
      .bind(new Date().toISOString(), userId)
      .run();
  }

  // Conversation history
  async getConversationHistory(userId: number, limit = 20) {
    const results = await this.db
      .prepare(
        'SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
      )
      .bind(userId, limit)
      .all();
    return results.results as any[];
  }

  async addConversation(userId: number, role: string, content: string, provider?: string, model?: string) {
    await this.db
      .prepare(
        `INSERT INTO conversations (user_id, role, content, provider, model, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(userId, role, content, provider || null, model || null, new Date().toISOString())
      .run();
  }

  async clearConversation(userId: number) {
    await this.db
      .prepare('DELETE FROM conversations WHERE user_id = ?')
      .bind(userId)
      .run();
  }

  // API usage tracking
  async trackApiUsage(userId: number, provider: string, model: string, tokens: number) {
    await this.db
      .prepare(
        `INSERT INTO api_usage (user_id, provider, model, tokens, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(userId, provider, model, tokens, new Date().toISOString())
      .run();
  }

  async getApiUsage(userId: number, period: 'day' | 'week' | 'month' = 'day') {
    const interval = period === 'day' ? '1 day' : period === 'week' ? '7 days' : '30 days';
    const result = await this.db
      .prepare(
        `SELECT provider, model, SUM(tokens) as total_tokens, COUNT(*) as request_count
         FROM api_usage
         WHERE user_id = ? AND created_at > datetime('now', ?)
         GROUP BY provider, model`
      )
      .bind(userId, `-${interval}`)
      .all();
    return result.results as any[];
  }

  // Favorites
  async addFavorite(userId: number, type: string, itemId: string, data: string) {
    await this.db
      .prepare(
        `INSERT INTO favorites (user_id, type, item_id, data, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(userId, type, itemId, data, new Date().toISOString())
      .run();
  }

  async getFavorites(userId: number, type?: string) {
    let query = 'SELECT * FROM favorites WHERE user_id = ?';
    const params: any[] = [userId];
    
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await this.db.prepare(query).bind(...params).all();
    return result.results as any[];
  }

  async removeFavorite(userId: number, type: string, itemId: string) {
    await this.db
      .prepare('DELETE FROM favorites WHERE user_id = ? AND type = ? AND item_id = ?')
      .bind(userId, type, itemId)
      .run();
  }

  // Download history
  async addDownload(userId: number, url: string, platform: string, filename: string) {
    await this.db
      .prepare(
        `INSERT INTO downloads (user_id, url, platform, filename, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(userId, url, platform, filename, new Date().toISOString())
      .run();
  }

  async getDownloadHistory(userId: number, limit = 10) {
    const result = await this.db
      .prepare(
        'SELECT * FROM downloads WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
      )
      .bind(userId, limit)
      .all();
    return result.results as any[];
  }

  // Statistics
  async getStats() {
    const users = await this.db.prepare('SELECT COUNT(*) as count FROM users').first();
    const messages = await this.db.prepare('SELECT COUNT(*) as count FROM conversations').first();
    const downloads = await this.db.prepare('SELECT COUNT(*) as count FROM downloads').first();
    
    return {
      totalUsers: (users as any)?.count || 0,
      totalMessages: (messages as any)?.count || 0,
      totalDownloads: (downloads as any)?.count || 0,
    };
  }

  // Rate limiting
  async checkRateLimit(userId: number, action: string, limit: number, windowSeconds: number = 60) {
    const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();
    
    const result = await this.db
      .prepare(
        `SELECT COUNT(*) as count FROM rate_limits
         WHERE user_id = ? AND action = ? AND created_at > ?`
      )
      .bind(userId, action, windowStart)
      .first();
    
    const count = (result as any)?.count || 0;
    
    if (count >= limit) {
      return false;
    }
    
    await this.db
      .prepare(
        'INSERT INTO rate_limits (user_id, action, created_at) VALUES (?, ?, ?)'
      )
      .bind(userId, action, new Date().toISOString())
      .run();
    
    return true;
  }
}
