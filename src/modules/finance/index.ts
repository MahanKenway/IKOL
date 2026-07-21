import { Composer, type Context } from 'grammy';
import { createCurrencyProvider, createGoldProvider, createCryptoProvider } from '../../services/providers/finance.js';
import { getLogger } from '../../services/logger/index.js';
import type { Env } from '../../types/env.js';
import type { FeatureFlags } from '../../services/feature-flags/index.js';
import type { IkolModule } from '../../bot/plugin-system.js';
import { registerModule } from '../../bot/plugin-system.js';

const logger = getLogger({ module: 'finance' });
const CURRENCIES = ['USD', 'EUR', 'GBP', 'TRY', 'CNY', 'JPY'];
const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', TRY: '₺', CNY: '¥', JPY: '¥' };

async function fetchCurrency(ctx: any) {
  const status = await ctx.reply('Fetching exchange rates...');
  const start = Date.now();
  try {
    const provider = createCurrencyProvider(ctx.env);
    const result = await provider.execute('currency', 'USD', CURRENCIES);
    let msg = 'Exchange Rates (USD)\n\n';
    for (const r of result.data) msg += `${SYMBOLS[r.to] || ''} ${r.to}: ${r.rate.toFixed(4)}\n`;
    msg += `\nLast updated: ${new Date().toLocaleDateString()}\nSource: ${result.provider}`;
    await ctx.api.editMessageText(ctx.chat!.id, status.message_id, msg, {
      reply_markup: { inline_keyboard: [[{ text: 'Refresh', callback_data: 'finance:currency' }]] },
    });
    logger.info('Currency fetched', { module: 'finance', provider: result.provider, latency: Date.now() - start, status: 'success' });
  } catch {
    await ctx.api.editMessageText(ctx.chat!.id, status.message_id, 'Failed to fetch rates. Try /currency');
    logger.error('Currency fetch failed', { module: 'finance', status: 'error', latency: Date.now() - start });
  }
}

async function fetchGold(ctx: any) {
  const status = await ctx.reply('Fetching gold prices...');
  const start = Date.now();
  try {
    const provider = createGoldProvider();
    const result = await provider.execute('gold');
    const gold = result.data.find((g: any) => g.metal === 'gold');
    if (!gold) { await ctx.api.editMessageText(ctx.chat!.id, status.message_id, 'Gold data unavailable.'); return; }
    const msg = `Gold Price\n\nPrice: $${gold.price.toFixed(2)}/oz\nChange: ${gold.change?.toFixed(2) || 'N/A'}\nChange %: ${gold.changePercent?.toFixed(2) || 'N/A'}%\n\nSource: ${result.provider}`;
    await ctx.api.editMessageText(ctx.chat!.id, status.message_id, msg, {
      reply_markup: { inline_keyboard: [[{ text: 'Refresh', callback_data: 'finance:gold' }]] },
    });
    logger.info('Gold fetched', { module: 'finance', provider: result.provider, latency: Date.now() - start, status: 'success' });
  } catch {
    await ctx.api.editMessageText(ctx.chat!.id, status.message_id, 'Failed to fetch gold prices. Try /gold');
    logger.error('Gold fetch failed', { module: 'finance', status: 'error', latency: Date.now() - start });
  }
}

async function fetchCrypto(ctx: any, coin: string) {
  const status = await ctx.reply(`Fetching ${coin} price...`);
  const start = Date.now();
  try {
    const provider = createCryptoProvider();
    const result = await provider.execute('crypto', coin);
    const msg = `${result.data.name} (${result.data.symbol})\n\nPrice: $${result.data.price.toLocaleString()}\n24h: ${result.data.change24h?.toFixed(2) || 'N/A'}%\nSource: ${result.provider}`;
    await ctx.api.editMessageText(ctx.chat!.id, status.message_id, msg);
    logger.info('Crypto fetched', { module: 'finance', provider: result.provider, latency: Date.now() - start, status: 'success' });
  } catch {
    await ctx.api.editMessageText(ctx.chat!.id, status.message_id, `"${coin}" not found or service unavailable.`);
    logger.error('Crypto fetch failed', { module: 'finance', status: 'error', latency: Date.now() - start });
  }
}

function createFinanceModule(): IkolModule {
  return {
    name: 'finance',
    featureFlag: 'finance',
    version: '2.0.0',
    register(composer: Composer<Context>, env: Env, flags: FeatureFlags) {
      composer.command('currency', fetchCurrency);
      composer.command('gold', fetchGold);
      composer.command('crypto', async (ctx) => {
        const coin = ctx.message?.text?.replace(/^\/crypto\s*/, '').trim().toLowerCase() || 'bitcoin';
        await fetchCrypto(ctx, coin);
      });
      composer.callbackQuery(/^finance:(.+)$/, async (ctx) => {
        const action = ctx.match[1];
        await ctx.answerCallbackQuery({ text: 'Refreshing...' });
        if (action === 'currency') await fetchCurrency(ctx);
        else if (action === 'gold') await fetchGold(ctx);
      });
    },
  };
}

registerModule(createFinanceModule());

const bot = new Composer<Context>();
export default bot;



