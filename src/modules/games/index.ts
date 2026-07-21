import { Composer, type Context } from 'grammy';
import { getLogger } from '../../services/logger/index.js';
import type { Env } from '../../types/env.js';
import type { FeatureFlags } from '../../services/feature-flags/index.js';
import type { IkolModule } from '../../bot/plugin-system.js';
import { registerModule } from '../../bot/plugin-system.js';

const logger = getLogger({ module: 'games' });

const EPIC_GAMES_QUERY = `query searchStoreQuery($allowCountries: String, $category: String, $count: Int, $sortBy: String, $sortDir: String, $freeGame: Boolean, $onSale: Boolean) {
  Catalog { searchStore(allowCountries: $allowCountries, category: $category, count: $count, sortBy: $sortBy, sortDir: $sortDir, freeGame: $freeGame, onSale: $onSale) {
    elements { title description id keyImages { type url } seller { name } price(country: $allowCountries) { totalPrice { discountPrice originalPrice } } promotions { promotionalOffers { promotionalOffers { startDate endDate discountSetting { discountPercentage } } } } }
  }
}`;

interface EpicGame { title: string; id: string; seller: { name: string }; promotions?: { promotionalOffers: { promotionalOffers: { endDate: string }[] }[] } }

async function fetchFreeGames(ctx: any) {
  const status = await ctx.reply('Fetching free games...');
  const start = Date.now();
  try {
    const res = await fetch('https://graphql.epicgames.com/graphql', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: EPIC_GAMES_QUERY, variables: { allowCountries: 'US', category: 'freegames', count: 10, sortBy: 'effectiveDate', sortDir: 'asc', freeGame: true, onSale: true } }),
    });
    const data = await res.json() as any;
    const games = (data?.data?.Catalog?.searchStore?.elements || []).filter((g: any) => g.price?.totalPrice?.discountPrice === 0);

    if (!games.length) { await ctx.api.editMessageText(ctx.chat!.id, status.message_id, 'No free games right now.'); return; }

    let msg = 'Free Games on Epic Store\n\n';
    games.forEach((g: EpicGame, i: number) => {
      const end = g.promotions?.promotionalOffers?.[0]?.promotionalOffers?.[0]?.endDate;
      msg += `${i + 1}. ${g.title}\n   ${g.seller?.name} | Free until: ${end ? new Date(end).toLocaleDateString() : 'Unknown'}\n\n`;
    });

    await ctx.api.editMessageText(ctx.chat!.id, status.message_id, msg, {
      reply_markup: { inline_keyboard: games.slice(0, 5).map((g: EpicGame) => [{ text: g.title.substring(0, 30), url: `https://store.epicgames.com/p/${g.id}` }]) },
    });
    logger.info('Free games fetched', { module: 'games', latency: Date.now() - start, status: 'success' });
  } catch {
    await ctx.api.editMessageText(ctx.chat!.id, status.message_id, 'Failed to fetch free games. Try /freegames');
    logger.error('Free games failed', { module: 'games', status: 'error', latency: Date.now() - start });
  }
}

function createGamesModule(): IkolModule {
  return {
    name: 'games',
    featureFlag: 'games',
    version: '2.0.0',
    register(composer: Composer<Context>, env: Env, flags: FeatureFlags) {
      composer.command('freegames', fetchFreeGames);
      composer.command('games', async (ctx) => {
        await ctx.reply('Gaming Hub\n\nChoose:', {
          reply_markup: { inline_keyboard: [[{ text: 'Free Games', callback_data: 'games:free' }]] },
        });
      });
      composer.callbackQuery(/^games:(.+)$/, async (ctx) => {
        await ctx.answerCallbackQuery();
        if (ctx.match[1] === 'free') await fetchFreeGames(ctx);
        else await ctx.reply('Coming soon!');
      });
    },
  };
}

registerModule(createGamesModule());

const bot = new Composer<Context>();
export default bot;



