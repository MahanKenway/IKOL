import { Composer } from 'grammy';
import { getLogger } from '../../services/logger/index.js';

const logger = getLogger({ module: 'games' });
const bot = new Composer();

// Epic Games free games GraphQL query
const EPIC_GAMES_QUERY = `
query searchStoreQuery($allowCountries: String, $category: String, $count: Int, $sortBy: String, $sortDir: String, $freeGame: Boolean, $onSale: Boolean) {
  Catalog {
    searchStore(allowCountries: $allowCountries, category: $category, count: $count, sortBy: $sortBy, sortDir: $sortDir, freeGame: $freeGame, onSale: $onSale) {
      elements {
        title
        description
        id
        keyImages {
          type
          url
        }
        seller {
          name
        }
        price(country: $allowCountries) {
          totalPrice {
            discountPrice
            originalPrice
            currencyCode
            fmtPrice {
              originalPrice
              discountPrice
              intermediatePrice
            }
          }
        }
        promotions {
          promotionalOffers {
            promotionalOffers {
              startDate
              endDate
              discountSetting {
                discountPercentage
              }
            }
          }
          upcomingPromotionalOffers {
            promotionalOffers {
              startDate
              endDate
              discountSetting {
                discountPercentage
              }
            }
          }
        }
      }
    }
  }
}`;

interface EpicGame {
  title: string;
  description: string;
  id: string;
  keyImages: { type: string; url: string }[];
  seller: { name: string };
  price: {
    totalPrice: {
      discountPrice: number;
      originalPrice: number;
      currencyCode: string;
    };
  };
  promotions?: {
    promotionalOffers: {
      promotionalOffers: {
        startDate: string;
        endDate: string;
      }[];
    }[];
  };
}

// /freegames command
bot.command('freegames', async (ctx) => {
  const statusMessage = await ctx.reply('🎮 Fetching free games...');
  
  try {
    // Fetch free games from Epic Games Store
    const response = await fetch('https://graphql.epicgames.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: EPIC_GAMES_QUERY,
        variables: {
          allowCountries: 'US',
          category: 'freegames',
          count: 10,
          sortBy: 'effectiveDate',
          sortDir: 'asc',
          freeGame: true,
          onSale: true,
        },
      }),
    });
    
    const data = await response.json() as any;
    const games = data?.data?.Catalog?.searchStore?.elements || [];
    
    // Filter for actually free games (discountPrice === 0)
    const freeGames = games.filter((game: EpicGame) => 
      game.price?.totalPrice?.discountPrice === 0
    );
    
    if (freeGames.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        '🎮 No free games available right now. Check back later!'
      );
      return;
    }
    
    let message = '🎮 **Free Games on Epic Games Store**\n\n';
    
    freeGames.forEach((game: EpicGame, index: number) => {
      const endDate = game.promotions?.promotionalOffers?.[0]?.promotionalOffers?.[0]?.endDate;
      const endsDate = endDate ? new Date(endDate).toLocaleDateString() : 'Unknown';
      
      message += `${index + 1}. **${game.title}**\n`;
      message += `   🏢 ${game.seller?.name}\n`;
      message += `   📅 Free until: ${endsDate}\n\n`;
    });
    
    message += '_Click on a game to view details_';
    
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      message,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: freeGames.slice(0, 5).map((game: EpicGame) => [
            {
              text: game.title.substring(0, 30),
              url: `https://store.epicgames.com/p/${game.id}`,
            },
          ]),
        },
      }
    );
    
    logger.info('Free games fetched', { count: freeGames.length });
    
  } catch (error) {
    logger.error('Free games fetch failed', error as Error);
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      '❌ Failed to fetch free games. Please try again.'
    );
  }
});

// /steam command - Steam specials
bot.command('steam', async (ctx) => {
  await ctx.reply(
    '🎮 **Steam Games**\n\n' +
    'Coming soon! Features will include:\n' +
    '• Free-to-play games\n' +
    '• Special offers\n' +
    '• New releases\n' +
    '• Game recommendations',
    { parse_mode: 'Markdown' }
  );
});

// /games command - Gaming menu
bot.command('games', async (ctx) => {
  await ctx.reply(
    '🎮 **Gaming Hub**\n\n' +
    'Choose a category:\n\n' +
    '🎁 Free Games - Current free games\n' +
    '🔥 Hot Deals - Best sales\n' +
    '🆕 New Releases - Latest games\n' +
    '📊 Game Stats - Player statistics',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🎁 Free Games', callback_data: 'games:free' },
            { text: '🔥 Hot Deals', callback_data: 'games:deals' },
          ],
          [
            { text: '🆕 New Releases', callback_data: 'games:new' },
            { text: '📊 Stats', callback_data: 'games:stats' },
          ],
        ],
      },
    }
  );
});

// Callback handlers
bot.callbackQuery(/^games:(.+)$/, async (ctx) => {
  const action = ctx.match[1];
  await ctx.answerCallbackQuery();
  
  switch (action) {
    case 'free':
      // Trigger freegames command
      break;
    case 'deals':
      await ctx.reply('🔥 Hot deals feature coming soon!');
      break;
    case 'new':
      await ctx.reply('🆕 New releases feature coming soon!');
      break;
    case 'stats':
      await ctx.reply('📊 Game stats feature coming soon!');
      break;
  }
});

export default bot;
