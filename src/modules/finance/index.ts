import { Composer } from 'grammy';
import { frankfurterApi, metalsApi } from '../../services/api/index.js';
import { getLogger } from '../../services/logger/index.js';

const logger = getLogger({ module: 'finance' });
const bot = new Composer();

// Currency codes
const CURRENCIES = ['USD', 'EUR', 'GBP', 'TRY', 'CNY', 'JPY'];
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', TRY: '₺', CNY: '¥', JPY: '¥',
};

// /currency command
bot.command('currency', async (ctx) => {
  const args = ctx.message?.text?.replace(/^\/currency\s*/, '').trim().split(/\s+/);
  
  const statusMessage = await ctx.reply('💰 Fetching exchange rates...');
  
  try {
    // Get USD rates against other currencies
    const rates = await frankfurterApi.get<{ rates: Record<string, number> }>(
      '/latest',
      { from: 'USD', to: CURRENCIES.join(',') }
    );
    
    let message = '💰 **Exchange Rates (USD)**\n\n';
    
    for (const [currency, rate] of Object.entries(rates.rates)) {
      const symbol = CURRENCY_SYMBOLS[currency] || '';
      message += `${symbol} **${currency}**: ${rate.toFixed(4)}\n`;
    }
    
    message += `\n📅 Last updated: ${new Date().toLocaleDateString()}`;
    
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      message,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Refresh', callback_data: 'finance:refresh_currency' },
            ],
          ],
        },
      }
    );
    
  } catch (error) {
    logger.error('Currency fetch failed', error as Error);
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      '❌ Failed to fetch exchange rates. Please try again.'
    );
  }
});

// /gold command
bot.command('gold', async (ctx) => {
  const statusMessage = await ctx.reply('🥇 Fetching gold prices...');
  
  try {
    // Get gold prices from metals.live
    const goldData = await metalsApi.get<any[]>('/spot');
    
    const goldInfo = goldData.find((g: any) => g.metal === 'gold');
    
    if (!goldInfo) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        '❌ Gold price data unavailable.'
      );
      return;
    }
    
    const message = 
      `🥇 **Gold Price**\n\n` +
      `💰 Price: $${goldInfo.price.toFixed(2)} / oz\n` +
      `📊 Change: ${goldInfo.chg?.toFixed(2) || 'N/A'}\n` +
      `📈 Change %: ${goldInfo.chgPerc?.toFixed(2) || 'N/A'}%\n\n` +
      `📅 Last updated: ${goldInfo.ch_time || new Date().toISOString()}`;
    
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      message,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Refresh', callback_data: 'finance:refresh_gold' },
            ],
          ],
        },
      }
    );
    
  } catch (error) {
    logger.error('Gold price fetch failed', error as Error);
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      '❌ Failed to fetch gold prices. Please try again.'
    );
  }
});

// /crypto command (bonus)
bot.command('crypto', async (ctx) => {
  const coin = ctx.message?.text?.replace(/^\/crypto\s*/, '').trim().toLowerCase() || 'bitcoin';
  
  const statusMessage = await ctx.reply(`🪙 Fetching ${coin} price...`);
  
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd&include_24hr_change=true`
    );
    const data = await response.json() as any;
    
    const coinData = data[coin];
    
    if (!coinData) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        `❌ Cryptocurrency "${coin}" not found.`
      );
      return;
    }
    
    const message = 
      `🪙 **${coin.charAt(0).toUpperCase() + coin.slice(1)}**\n\n` +
      `💰 Price: $${coinData.usd.toLocaleString()}\n` +
      `📈 24h Change: ${coinData.usd_24h_change?.toFixed(2) || 'N/A'}%`;
    
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      message,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    logger.error('Crypto price fetch failed', error as Error);
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      '❌ Failed to fetch crypto prices.'
    );
  }
});

// Callback handlers
bot.callbackQuery('finance:refresh_currency', async (ctx) => {
  await ctx.answerCallbackQuery();
  // Re-trigger currency command
  await ctx.reply('🔄 Refreshing exchange rates...');
  // In a real implementation, you'd re-fetch and update the message
});

bot.callbackQuery('finance:refresh_gold', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply('🔄 Refreshing gold prices...');
});

export default bot;
