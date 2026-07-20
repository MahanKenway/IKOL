import { Composer, Context } from 'grammy';
import { getLogger } from '../../services/logger/index.js';

const logger = getLogger({ module: 'ai-enhanced' });
const bot = new Composer();

// AI Provider interface with streaming support
interface AiProvider {
  name: string;
  chat(messages: { role: string; content: string }[], model: string): Promise<string>;
  chatStream?(messages: { role: string; content: string }[], model: string): AsyncGenerator<string>;
}

// Enhanced OpenAI Provider with streaming
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

  async *chatStream(messages: { role: string; content: string }[], model: string): AsyncGenerator<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-3.5-turbo',
        messages,
        stream: true,
      }),
    });

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  }
}

// Enhanced Gemini Provider with streaming
class GeminiProvider implements AiProvider {
  name = 'gemini';

  async chat(messages: { role: string; content: string }[], model: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    const modelName = model || 'gemini-1.5-flash';

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

  async *chatStream(messages: { role: string; content: string }[], model: string): AsyncGenerator<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    const modelName = model || 'gemini-1.5-flash';

    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
      }
    );

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Try to parse JSON chunks
      try {
        const data = JSON.parse(buffer);
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) {
          yield content;
        }
        buffer = '';
      } catch {
        // Wait for more data
      }
    }
  }
}

// Provider factory
function getProvider(providerName: string): AiProvider {
  switch (providerName) {
    case 'openai': return new OpenAiProvider();
    case 'gemini': return new GeminiProvider();
    default: return new GeminiProvider();
  }
}

// Streaming message updater
async function sendStreamingResponse(
  ctx: Context,
  provider: AiProvider,
  messages: { role: string; content: string }[],
  model: string
): Promise<string> {
  if (!provider.chatStream) {
    return provider.chat(messages, model);
  }

  // Send initial message
  const initialMessage = await ctx.reply('🤔 Thinking...');

  let fullResponse = '';
  let lastUpdate = 0;
  const updateInterval = 1000; // Update every 1 second

  try {
    for await (const chunk of provider.chatStream(messages, model)) {
      fullResponse += chunk;

      // Throttle updates to avoid rate limits
      if (Date.now() - lastUpdate > updateInterval) {
        try {
          await ctx.api.editMessageText(
            ctx.chat.id,
            initialMessage.message_id,
            fullResponse + ' ▌'
          );
          lastUpdate = Date.now();
        } catch {
          // Ignore edit errors (message too long, etc.)
        }
      }
    }

    // Final update without cursor
    await ctx.api.editMessageText(
      ctx.chat.id,
      initialMessage.message_id,
      fullResponse
    );

    return fullResponse;
  } catch (error) {
    // On error, try to update with what we have
    if (fullResponse) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        initialMessage.message_id,
        fullResponse
      );
    }
    throw error;
  }
}

// /ai command with streaming
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

// Handle AI chat with streaming
async function handleAiChat(ctx: any, message: string) {
  const db = (ctx as any).db;
  const userId = ctx.from?.id;

  if (!userId) return;

  // Check rate limit
  if (db) {
    const isAllowed = await db.checkRateLimit(userId, 'ai', 10, 60);
    if (!isAllowed) {
      await ctx.reply('⚠️ AI rate limit exceeded. Please wait a minute.');
      return;
    }
  }

  try {
    // Get user settings
    let providerName = 'gemini';
    let model = 'gemini-1.5-flash';

    if (db) {
      const user = await db.getUser(userId);
      const settings = user?.settings ? JSON.parse(user.settings) : {};
      providerName = settings.aiProvider || 'gemini';
      model = settings.aiModel || (providerName === 'gemini' ? 'gemini-1.5-flash' : 'gpt-3.5-turbo');
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

    // Get AI provider
    const provider = getProvider(providerName);

    // Send streaming response
    const response = await sendStreamingResponse(ctx, provider, messages, model);

    // Save to conversation history
    if (db) {
      await db.addConversation(userId, 'user', message, providerName, model);
      await db.addConversation(userId, 'assistant', response, providerName, model);
      await db.trackApiUsage(userId, providerName, model, response.length);
    }

    logger.info('AI chat completed', { userId, provider: providerName, model });

  } catch (error) {
    logger.error('AI chat failed', error as Error, { userId });
    await ctx.reply('❌ AI service temporarily unavailable. Please try again later.');
  }
}

// Handle plain text messages as AI chat
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;

  // Skip commands
  if (text.startsWith('/')) return;

  const db = (ctx as any).db;
  const userId = ctx.from?.id;

  if (!db || !userId) return;

  // Check if user has recent AI history (suggests they're in AI mode)
  const history = await db.getConversationHistory(userId, 5);
  
  // If recent history exists or message is substantial, treat as AI chat
  if (history.length > 0 || text.length > 20) {
    await handleAiChat(ctx, text);
  }
});

export default bot;
