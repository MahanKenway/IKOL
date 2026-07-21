import { Composer, type Context } from 'grammy';
import { getLogger } from '../../services/logger/index.js';
import type { Env } from '../../types/env.js';
import type { FeatureFlags } from '../../services/feature-flags/index.js';
import type { IkolModule } from '../../bot/plugin-system.js';
import { registerModule } from '../../bot/plugin-system.js';

const logger = getLogger({ module: 'space' });

function nasaUrl(path: string, env: Record<string, string | undefined>, params?: Record<string, string>): string {
  const url = new URL(`https://api.nasa.gov${path}`);
  url.searchParams.set('api_key', env.NASA_API_KEY || 'DEMO_KEY');
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

async function fetchApod(ctx: any) {
  const status = await ctx.reply('Fetching APOD...');
  const start = Date.now();
  try {
    const env = ctx.env;
    const res = await fetch(nasaUrl('/planetary/apod', env));
    if (!res.ok) throw new Error(`NASA ${res.status}`);
    const data = await res.json() as any;
    const text = `${data.title}\n\n${(data.explanation || '').substring(0, 500)}${data.explanation?.length > 500 ? '...' : ''}\n\nDate: ${data.date} | Credit: ${data.copyright || 'NASA'}`;
    if (data.media_type === 'image' && data.url) {
      await ctx.replyWithPhoto(data.url, { caption: text.substring(0, 1024) });
      await ctx.api.deleteMessage(ctx.chat!.id, status.message_id).catch(() => {});
    } else {
      await ctx.api.editMessageText(ctx.chat!.id, status.message_id, text + (data.media_type === 'video' ? `\nVideo: ${data.url}` : ''));
    }
    logger.info('APOD fetched', { module: 'space', latency: Date.now() - start, status: 'success' });
  } catch {
    await ctx.api.editMessageText(ctx.chat!.id, status.message_id, 'Failed to fetch APOD. Try /apod');
    logger.error('APOD failed', { module: 'space', status: 'error', latency: Date.now() - start });
  }
}

async function fetchSpacex(ctx: any) {
  const status = await ctx.reply('Fetching SpaceX launch...');
  const start = Date.now();
  try {
    const res = await fetch('https://api.spacexdata.com/v4/launches/latest');
    if (!res.ok) throw new Error(`SpaceX ${res.status}`);
    const launch = await res.json() as any;
    const text = `${launch.name}\n\nDate: ${new Date(launch.date_utc).toLocaleDateString()}\nStatus: ${launch.success ? 'Success' : 'Failed'}\n${launch.details || ''}`;
    if (launch.links?.patch?.large) {
      await ctx.replyWithPhoto(launch.links.patch.large, { caption: text.substring(0, 1024) });
      await ctx.api.deleteMessage(ctx.chat!.id, status.message_id).catch(() => {});
    } else {
      await ctx.api.editMessageText(ctx.chat!.id, status.message_id, text);
    }
    logger.info('SpaceX fetched', { module: 'space', latency: Date.now() - start, status: 'success' });
  } catch {
    await ctx.api.editMessageText(ctx.chat!.id, status.message_id, 'Failed to fetch SpaceX data. Try /spacex');
    logger.error('SpaceX failed', { module: 'space', status: 'error', latency: Date.now() - start });
  }
}

async function fetchMars(ctx: any) {
  const status = await ctx.reply('Fetching Mars photos...');
  const start = Date.now();
  try {
    const env = ctx.env;
    const res = await fetch(nasaUrl('/mars-photos/api/v1/rovers/curiosity/photos', env, { sol: '1000', page: '1' }));
    if (!res.ok) throw new Error(`NASA ${res.status}`);
    const data = await res.json() as any;
    const photo = data.photos?.[0];
    if (!photo) { await ctx.api.editMessageText(ctx.chat!.id, status.message_id, 'No Mars photos available.'); return; }
    await ctx.replyWithPhoto(photo.img_src, { caption: `Camera: ${photo.camera?.full_name}\nDate: ${photo.earth_date}` });
    await ctx.api.deleteMessage(ctx.chat!.id, status.message_id).catch(() => {});
    logger.info('Mars fetched', { module: 'space', latency: Date.now() - start, status: 'success' });
  } catch {
    await ctx.api.editMessageText(ctx.chat!.id, status.message_id, 'Failed to fetch Mars photos. Try /mars');
    logger.error('Mars failed', { module: 'space', status: 'error', latency: Date.now() - start });
  }
}

function createSpaceModule(): IkolModule {
  return {
    name: 'space',
    featureFlag: 'space',
    version: '2.0.0',
    register(composer: Composer<Context>, env: Env, flags: FeatureFlags) {
      composer.command('apod', fetchApod);
      composer.command('spacex', fetchSpacex);
      composer.command('mars', fetchMars);
      composer.command('space', async (ctx) => {
        await ctx.reply('Space Information\n\nChoose a category:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'APOD', callback_data: 'space:apod' }, { text: 'SpaceX', callback_data: 'space:spacex' }],
              [{ text: 'Mars', callback_data: 'space:mars' }],
            ],
          },
        });
      });
      composer.callbackQuery(/^space:(.+)$/, async (ctx) => {
        const action = ctx.match[1];
        await ctx.answerCallbackQuery();
        if (action === 'apod') await fetchApod(ctx);
        else if (action === 'spacex') await fetchSpacex(ctx);
        else if (action === 'mars') await fetchMars(ctx);
      });
    },
  };
}

registerModule(createSpaceModule());

const bot = new Composer<Context>();
export default bot;



