import { Composer } from 'grammy';
import { getLogger } from '../../services/logger/index.js';

const logger = getLogger({ module: 'ai' });
const bot = new Composer();

// AI Provider interface
interface AiProvider {
  name: string;
  chat(messages: { role: string; content: string }[], model: string): Promise<string>;
}

// OpenAI Provider
class OpenAiProvider implements AiProvider {
  name = 'openai';
  
  async chat(messages: { role: string; content: string }[], model: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-3.5-turbo',
        messages,
      }),
    });
    
    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || 'No response';
  }
}

// Gemini Provider
class GeminiProvider implements AiProvider {
  name = 'gemini';
  
  async chat(messages: { role: string; content: string }[], model: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    const modelName = model || 'gemini-1.5-flash';
    
    // Convert messages to Gemini format
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
      }
    );
    
    const data = await response.json() as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
  }
}

// Claude Provider
class ClaudeProvider implements AiProvider {
  name = 'claude';
  
  async chat(messages: { role: string; content: string }[], model: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: messages.filter(m => m.role !== 'system'),
      }),
    });
    
    const data = await response.json() as any;
    return data.content?.[0]?.text || 'No response';
  }
}

// OpenRouter Provider (uses OpenAI-compatible API)
class OpenRouterProvider implements AiProvider {
  name = 'openrouter';
  
  async chat(messages: { role: string; content: string }[], model: string): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://github.com/ikol-bot',
      },
      body: JSON.stringify({
        model: model || 'meta-llama/llama-3-8b-instruct',
        messages,
      }),
    });
    
    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || 'No response';
  }
}

// Provider factory
function getProvider(providerName: string): AiProvider {
  switch (providerName) {
    case 'openai': return new OpenAiProvider();
    case 'gemini': return new GeminiProvider();
    case 'claude': return new ClaudeProvider();
    case 'openrouter': return new OpenRouterProvider();
    default: return new GeminiProvider(); // Default to Gemini
  }
}

// /ai command
bot.command('ai', async (ctx) => {
  const message = ctx.message?.text?.replace(/^\/ai\s*/, '').trim();
  
  if (!message) {
    await ctx.reply(
      '🤖 **AI Chat**\n\n' +
      'Start a conversation with AI!\n\n' +
      'Usage:\n' +
      '`/ai <your message>` - Send a message\n' +
      '`/model` - Change AI model\n' +
      '`/clear` - Clear conversation history\n\n' +
      'Or just send any text message to chat!',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  await handleAiChat(ctx, message);
});

// /model command
bot.command('model', async (ctx) => {
  await ctx.reply(
    '🧠 **AI Model Selection**\n\n' +
    'Choose a provider:\n\n' +
    '1️⃣ Gemini (Google) - Fast, free tier\n' +
    '2️⃣ OpenAI - GPT-3.5/4\n' +
    '3️⃣ Claude (Anthropic) - High quality\n' +
    '4️⃣ OpenRouter - Multiple models',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✨ Gemini', callback_data: 'ai:provider:gemini' }],
          [{ text: '🟢 OpenAI', callback_data: 'ai:provider:openai' }],
          [{ text: '🟣 Claude', callback_data: 'ai:provider:claude' }],
          [{ text: '🔀 OpenRouter', callback_data: 'ai:provider:openrouter' }],
        ],
      },
    }
  );
});

// /clear command
bot.command('clear', async (ctx) => {
  const db = (ctx as any).db;
  const userId = ctx.from?.id;
  
  if (db && userId) {
    await db.clearConversation(userId);
    await ctx.reply('✅ Conversation history cleared.');
  }
});

// Handle AI provider selection callback
bot.callbackQuery(/^ai:provider:(.+)$/, async (ctx) => {
  const provider = ctx.match[1];
  const db = (ctx as any).db;
  const userId = ctx.from?.id;
  
  await ctx.answerCallbackQuery();
  
  if (db && userId) {
    // Update user settings
    const user = await db.getUser(userId);
    const settings = user?.settings ? JSON.parse(user.settings) : {};
    settings.aiProvider = provider;
    await db.updateUser(userId, { settings: JSON.stringify(settings) });
    
    await ctx.reply(`✅ AI provider changed to **${provider}**`, {
      parse_mode: 'Markdown',
    });
  }
});

// Handle plain text messages as AI chat
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  
  // Skip commands
  if (text.startsWith('/')) return;
  
  // Check if user is in AI chat mode (could check settings or session)
  const db = (ctx as any).db;
  const userId = ctx.from?.id;
  
  if (!db || !userId) return;
  
  // Check if user has AI enabled or has been chatting
  const history = await db.getConversationHistory(userId, 10);
  
  // If recent history exists, continue the conversation
  if (history.length > 0 || text.length > 10) {
    await handleAiChat(ctx, text);
  }
});

async function handleAiChat(ctx: any, message: string) {
  const db = (ctx as any).db;
  const userId = ctx.from?.id;
  const cache = (ctx as any).cache;
  
  if (!userId) return;
  
  // Check rate limit
  if (db) {
    const isAllowed = await db.checkRateLimit(userId, 'ai', 10, 60);
    if (!isAllowed) {
      await ctx.reply('⚠️ AI rate limit exceeded. Please wait a minute.');
      return;
    }
  }
  
  const statusMessage = await ctx.reply('🤔 Thinking...');
  
  try {
    // Get user settings
    let providerName = 'gemini';
    let model = 'gemini-1.5-flash';
    
    if (db) {
      const user = await db.getUser(userId);
      const settings = user?.settings ? JSON.parse(user.settings) : {};
      providerName = settings.aiProvider || 'gemini';
      model = settings.aiModel || (providerName === 'gemini' ? 'gemini-1.5-flash' : 
                                   providerName === 'openai' ? 'gpt-3.5-turbo' :
                                   providerName === 'claude' ? 'claude-3-haiku-20240307' :
                                   'meta-llama/llama-3-8b-instruct');
    }
    
    // Get conversation history
    const history = db ? await db.getConversationHistory(userId, 20) : [];
    const messages = history.reverse().map((h: any) => ({
      role: h.role,
      content: h.content,
    }));
    
    // Add system message
    messages.unshift({
      role: 'system',
      content: 'You are Ikol, a helpful AI assistant in Telegram. Be concise and helpful. Use emojis sparingly.',
    });
    
    // Add user message
    messages.push({ role: 'user', content: message });
    
    // Get AI response
    const provider = getProvider(providerName);
    const response = await provider.chat(messages, model);
    
    // Save to conversation history
    if (db) {
      await db.addConversation(userId, 'user', message, providerName, model);
      await db.addConversation(userId, 'assistant', response, providerName, model);
      await db.trackApiUsage(userId, providerName, model, response.length); // Approximate tokens
    }
    
    // Send response
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      response,
      { parse_mode: 'Markdown' }
    );
    
    logger.info('AI chat completed', { userId, provider: providerName, model });
    
  } catch (error) {
    logger.error('AI chat failed', error as Error, { userId });
    
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      '❌ AI service temporarily unavailable. Please try again later.'
    );
  }
}

export default bot;
