import { Composer, type Context } from 'grammy';
import { TieredCache } from '../../services/cache/tiered.js';
import { getLogger } from '../../services/logger/index.js';
import type { Env } from '../../types/env.js';
import type { FeatureFlags } from '../../services/feature-flags/index.js';
import type { IkolModule } from '../../bot/plugin-system.js';
import { registerModule } from '../../bot/plugin-system.js';

const logger = getLogger({ module: 'ai' });

// AI Provider interface
interface AiProvider {
  name: string;
  chat(messages: { role: string; content: string }[], model: string): Promise<string>;
  chatStream?(messages: { role: string; content: string }[], model: string): AsyncGenerator<string>;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return promise.finally(() => clearTimeout(timeout));
}

// OpenAI Provider
class OpenAiProvider implements AiProvider {
  name = 'openai';
  constructor(private apiKey: string) {}

  async chat(messages: { role: string; content: string }[], model: string): Promise<string> {
    const res = await withTimeout(fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: model || 'gpt-3.5-turbo', messages, max_tokens: 2048 }),
    }), 25000);
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json() as any;
    return data.choices?.[0]?.message?.content || '';
  }

  async *chatStream(messages: { role: string; content: string }[], model: string): AsyncGenerator<string> {
    const res = await withTimeout(fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: model || 'gpt-3.5-turbo', messages, stream: true, max_tokens: 2048 }),
    }), 25000);
    if (!res.ok) throw new Error(`OpenAI stream ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const d = line.slice(6);
          if (d === '[DONE]') return;
          try { yield JSON.parse(d).choices?.[0]?.delta?.content || ''; } catch {}
        }
      }
    }
  }
}

// Gemini Provider — uses x-goog-api-key header instead of query param
class GeminiProvider implements AiProvider {
  name = 'gemini';
  constructor(private apiKey: string) {}

  private buildBody(messages: { role: string; content: string }[]) {
    const systemMsg = messages.find(m => m.role === 'system');
    const contents = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const body: Record<string, unknown> = { contents };
    if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    return body;
  }

  async chat(messages: { role: string; content: string }[], model: string): Promise<string> {
    const name = model || 'gemini-1.5-flash';
    const res = await withTimeout(fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${name}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(this.buildBody(messages)),
      }
    ), 25000);
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json() as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async *chatStream(messages: { role: string; content: string }[], model: string): AsyncGenerator<string> {
    const name = model || 'gemini-1.5-flash';
    const res = await withTimeout(fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${name}:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(this.buildBody(messages)),
      }
    ), 25000);
    if (!res.ok) throw new Error(`Gemini stream ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try { yield JSON.parse(line.slice(6)).candidates?.[0]?.content?.parts?.[0]?.text || ''; } catch {}
        }
      }
    }
  }
}

// OpenRouter Provider
class OpenRouterProvider implements AiProvider {
  name = 'openrouter';
  constructor(private apiKey: string) {}

  async chat(messages: { role: string; content: string }[], model: string): Promise<string> {
    const res = await withTimeout(fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: model || 'meta-llama/llama-3-8b-instruct', messages, max_tokens: 2048 }),
    }), 25000);
    if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
    const data = await res.json() as any;
    return data.choices?.[0]?.message?.content || '';
  }
}

// Cloudflare Workers AI Provider — uses the AI binding, no API key needed
class WorkersAiProvider implements AiProvider {
  name = 'workers-ai';
  private ai: Ai;

  constructor(ai: Ai) {
    this.ai = ai;
  }

  async chat(messages: { role: string; content: string }[], model: string): Promise<string> {
    const modelName = (model || '@cf/meta/llama-3.1-8b-instruct') as any;
    const formattedMessages = messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    const result: any = await this.ai.run(modelName, {
      messages: formattedMessages,
      max_tokens: 2048,
    });

    return result.response || '';
  }
}

// Build provider chain based on available keys
function buildProviderChain(env: Record<string, string | undefined>, preferred?: string): { name: string; model: string; provider: AiProvider }[] {
  const chain: { name: string; model: string; provider: AiProvider }[] = [];
  const added = new Set<string>();

  const add = (name: string, model: string, create: () => AiProvider) => {
    if (!added.has(name)) { chain.push({ name, model, provider: create() }); added.add(name); }
  };

  // Preferred first
  if (preferred === 'openai' && env.OPENAI_API_KEY) add('openai', 'gpt-3.5-turbo', () => new OpenAiProvider(env.OPENAI_API_KEY!));
  if (preferred === 'gemini' && env.GEMINI_API_KEY) add('gemini', 'gemini-1.5-flash', () => new GeminiProvider(env.GEMINI_API_KEY!));

  // Fallbacks
  if (env.GEMINI_API_KEY) add('gemini', 'gemini-1.5-flash', () => new GeminiProvider(env.GEMINI_API_KEY!));
  if (env.OPENAI_API_KEY) add('openai', 'gpt-3.5-turbo', () => new OpenAiProvider(env.OPENAI_API_KEY!));
  if (env.OPENROUTER_API_KEY) add('openrouter', 'meta-llama/llama-3-8b-instruct', () => new OpenRouterProvider(env.OPENROUTER_API_KEY!));
  // Workers AI - free, no API key needed
  if ((env as any).AI) add('workers-ai', '@cf/meta/llama-3.1-8b-instruct', () => new WorkersAiProvider((env as any).AI));

  return chain;
}

// Send AI response with streaming + fallback
async function sendAiResponse(
  ctx: Context,
  messages: { role: string; content: string }[],
  providerName: string,
  model: string,
  env: Record<string, string | undefined>
): Promise<string> {
  const chain = buildProviderChain(env, providerName);
  if (chain.length === 0) throw new Error('No AI providers configured');

  // Try streaming first with preferred provider
  const preferred = chain[0];
  if (preferred.provider.chatStream) {
    try {
      const initialMessage = await ctx.reply('Thinking...');
      let full = '';
      let lastUpdate = 0;

      for await (const chunk of preferred.provider.chatStream(messages, preferred.model)) {
        full += chunk;
        if (Date.now() - lastUpdate > 1500) {
          try {
            const text = full.length > 4000 ? full.substring(0, 4000) + '...' : full;
            await ctx.api.editMessageText(ctx.chat!.id, initialMessage.message_id, text + ' ...');
            lastUpdate = Date.now();
          } catch {}
        }
      }

      const finalText = full.length > 4000 ? full.substring(0, 4000) + '...' : full;
      await ctx.api.editMessageText(ctx.chat!.id, initialMessage.message_id, finalText);
      return full;
    } catch {}
  }

  // Fallback: try all providers with non-streaming
  for (const p of chain) {
    try {
      logger.info(`Trying ${p.name} (${p.model})`, { module: 'ai', provider: p.name });
      const response = await p.provider.chat(messages, p.model);
      if (response) {
        const text = response.length > 4000 ? response.substring(0, 4000) + '...' : response;
        await ctx.reply(text);
        return response;
      }
    } catch (e) {
      logger.warn(`${p.name} failed`, { module: 'ai', provider: p.name, error: (e as Error).message });
    }
  }

  throw new Error('All AI providers failed');
}

// Cache key for deduplicating identical questions
function cacheKey(messages: { role: string; content: string }[]): string {
  const lastUser = messages.filter(m => m.role === 'user').pop();
  return `ai:${lastUser?.content?.substring(0, 100) || 'empty'}`;
}

// Handle AI chat
async function handleAiChat(ctx: any, message: string) {
  const db = ctx.db;
  const userId = ctx.from?.id;
  const env = ctx.env;
  const cache = ctx.cache as TieredCache | undefined;

  if (!userId) return;

  // Rate limit
  const rl = ctx.rateLimiter;
  if (rl) {
    try {
      const result = await rl.check(`ai:${userId}`, 15, 60);
      if (!result.allowed) {
        await ctx.reply(`Rate limit reached. Try again in ${result.retryAfter}s.`);
        return;
      }
    } catch {}
  }

  // Get settings
  let providerName = 'gemini';
  let model = 'gemini-1.5-flash';
  if (db) {
    try {
      const user = await db.getUser(userId);
      if (user?.settings) {
        const s = JSON.parse(user.settings);
        providerName = s.aiProvider || 'gemini';
        model = s.aiModel || (providerName === 'gemini' ? 'gemini-1.5-flash' : 'gpt-3.5-turbo');
      }
    } catch {}
  }

  // Get history
  let history: any[] = [];
  if (db) {
    try { history = await db.getConversationHistory(userId, 20); } catch {}
  }

  const messages = [
    { role: 'system', content: 'You are Ikol, a helpful AI assistant in Telegram. Be concise and helpful. Respond in the same language the user writes in.' },
    ...history.map((h: any) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  // Check cache for repeated questions (short TTL)
  if (cache) {
    try {
      const key = cacheKey(messages);
      const cached = await cache.get<string>(key);
      if (cached) {
        await ctx.reply(cached.length > 4000 ? cached.substring(0, 4000) + '...' : cached);
        return;
      }
    } catch {}
  }

  try {
    const start = Date.now();
    const response = await sendAiResponse(ctx, messages, providerName, model, env);
    const latency = Date.now() - start;

    logger.info('AI response completed', {
      module: 'ai',
      provider: providerName,
      latency,
      status: 'success',
      userId,
    });

    // Cache short responses
    if (cache && response && response.length < 500) {
      try { await cache.set(cacheKey(messages), response, 'ai', 300); } catch {}
    }

    // Save to history
    if (db) {
      try {
        await db.addConversation(userId, 'user', message, providerName, model);
        await db.addConversation(userId, 'assistant', response, providerName, model);
        await db.trackApiUsage(userId, providerName, model, Math.ceil(response.length / 4));
      } catch {}
    }
  } catch (error) {
    logger.error('AI response failed', {
      module: 'ai',
      provider: providerName,
      status: 'error',
      userId,
      error: (error as Error).message,
    });
    await ctx.reply('AI is temporarily unavailable. Please try again.');
  }
}

// Create the AI module
function createAiModule(): IkolModule {
  return {
    name: 'ai',
    featureFlag: 'ai',
    version: '2.0.0',
    register(composer: Composer<Context>, env: Env, flags: FeatureFlags) {
      // /ai command
      composer.command('ai', async (ctx) => {
        const message = ctx.message?.text?.replace(/^\/ai\s*/, '').trim();
        if (!message) {
          await ctx.reply(
            'AI Chat\n\n' +
            'Usage: /ai <your message>\n' +
            '/model - Change AI model\n' +
            '/clear - Clear history\n\n' +
            'Or just send me a message!'
          );
          return;
        }
        await handleAiChat(ctx, message);
      });

      // /model command
      composer.command('model', async (ctx) => {
        const arg = ctx.message?.text?.replace(/^\/model\s*/, '').trim().toLowerCase();
        const db = (ctx as any).db;
        const userId = ctx.from?.id;
        const envCtx = (ctx as any).env;

        if (!arg) {
          let current = 'gemini';
          if (db && userId) {
            try {
              const user = await db.getUser(userId);
              if (user?.settings) current = JSON.parse(user.settings).aiProvider || 'gemini';
            } catch {}
          }
          const available = [];
          if (envCtx?.GEMINI_API_KEY) available.push('gemini');
          if (envCtx?.OPENAI_API_KEY) available.push('openai');
          if (envCtx?.OPENROUTER_API_KEY) available.push('openrouter');
          await ctx.reply(`Current: ${current}\n\nAvailable: ${available.join(', ') || 'none'}\n\nUse /model <name> to change`);
          return;
        }

        if (!db || !userId) { await ctx.reply('Database not available.'); return; }
        const valid = ['gemini', 'openai', 'openrouter'];
        if (!valid.includes(arg)) { await ctx.reply(`Options: ${valid.join(', ')}`); return; }

        try {
          const user = await db.getUser(userId);
          const settings = user?.settings ? JSON.parse(user.settings) : {};
          settings.aiProvider = arg;
          settings.aiModel = arg === 'gemini' ? 'gemini-1.5-flash' : arg === 'openai' ? 'gpt-3.5-turbo' : 'meta-llama/llama-3-8b-instruct';
          await db.updateUser(userId, { settings: JSON.stringify(settings) });
          await ctx.reply(`AI provider set to ${arg}`);
        } catch {
          await ctx.reply('Failed to update settings.');
        }
      });

      // /clear command
      composer.command('clear', async (ctx) => {
        const db = (ctx as any).db;
        const userId = ctx.from?.id;
        if (!db || !userId) { await ctx.reply('Database not available.'); return; }
        try {
          await db.clearConversation(userId);
          await ctx.reply('History cleared.');
        } catch {
          await ctx.reply('Failed to clear history.');
        }
      });

      // Handle plain text messages (AI chat)
      composer.on('message:text', async (ctx, next) => {
        const text = ctx.message.text;
        if (text.startsWith('/')) { await next(); return; }

        const db = (ctx as any).db;
        const userId = ctx.from?.id;

        if (!db || !userId) {
          const envCtx = (ctx as any).env;
          if (envCtx?.GEMINI_API_KEY || envCtx?.OPENAI_API_KEY) {
            await handleAiChat(ctx, text);
          }
          return;
        }

        try {
          const history = await db.getConversationHistory(userId, 5);
          if (history.length > 0) {
            await handleAiChat(ctx, text);
            return;
          }

          const botName = (ctx as any).botInfo?.first_name?.toLowerCase() || 'ikol';
          const addressed = text.toLowerCase().includes(botName);
          if (addressed || text.length > 30) {
            await handleAiChat(ctx, text);
            return;
          }
        } catch {
          const envCtx = (ctx as any).env;
          if (envCtx?.GEMINI_API_KEY || envCtx?.OPENAI_API_KEY) {
            await handleAiChat(ctx, text);
          }
        }
      });
    },
  };
}

// Auto-register
registerModule(createAiModule());

// Export for backward compatibility
const bot = new Composer<Context>();
export default bot;


