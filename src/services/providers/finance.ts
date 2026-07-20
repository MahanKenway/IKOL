import { MultiProvider, type CurrencyRate, type GoldPrice, type CryptoPrice } from '../providers/index.js';
import { getLogger } from '../logger/index.js';

const logger = getLogger({ service: 'FinanceProvider' });

// Frankfurter Provider (Free, unlimited)
class FrankfurterProvider {
  name = 'frankfurter';
  priority = 1;

  async execute(base: string, targets: string[]): Promise<CurrencyRate[]> {
    const response = await fetch(
      `https://api.frankfurter.app/latest?from=${base}&to=${targets.join(',')}`
    );

    if (!response.ok) {
      throw new Error(`Frankfurter returned ${response.status}`);
    }

    const data = await response.json() as any;

    return Object.entries(data.rates).map(([currency, rate]) => ({
      from: base,
      to: currency,
      rate: rate as number,
      timestamp: Date.now(),
      source: 'frankfurter',
    }));
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR');
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ExchangeRate-API Provider
class ExchangeRateProvider {
  name = 'exchangerate-api';
  priority = 2;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.EXCHANGERATE_API_KEY || '';
  }

  async execute(base: string, targets: string[]): Promise<CurrencyRate[]> {
    if (!this.apiKey) {
      throw new Error('ExchangeRate API key not configured');
    }

    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${this.apiKey}/pair/${base}/${targets[0]}`
    );

    if (!response.ok) {
      throw new Error(`ExchangeRate API returned ${response.status}`);
    }

    const data = await response.json() as any;

    return [{
      from: base,
      to: targets[0],
      rate: data.conversion_rate,
      timestamp: Date.now(),
      source: 'exchangerate-api',
    }];
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}

// Metals.live Provider (Gold prices)
class MetalsProvider {
  name = 'metals-live';
  priority = 1;

  async execute(): Promise<GoldPrice[]> {
    const response = await fetch('https://api.metals.live/v1/spot');

    if (!response.ok) {
      throw new Error(`Metals.live returned ${response.status}`);
    }

    const data = await response.json() as any[];

    return data.map((metal: any) => ({
      price: metal.price,
      change: metal.chg || 0,
      changePercent: metal.chgPerc || 0,
      timestamp: Date.now(),
      source: 'metals-live',
      metal: metal.metal,
    }));
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('https://api.metals.live/v1/spot');
      return response.ok;
    } catch {
      return false;
    }
  }
}

// CoinGecko Provider (Crypto)
class CoinGeckoProvider {
  name = 'coingecko';
  priority = 1;

  async execute(coinId: string): Promise<CryptoPrice> {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
    );

    if (!response.ok) {
      throw new Error(`CoinGecko returned ${response.status}`);
    }

    const data = await response.json() as any;
    const coin = data[coinId];

    if (!coin) {
      throw new Error(`Coin ${coinId} not found`);
    }

    return {
      id: coinId,
      symbol: coinId.toUpperCase().substring(0, 3),
      name: coinId.charAt(0).toUpperCase() + coinId.slice(1),
      price: coin.usd,
      change24h: coin.usd_24h_change || 0,
      marketCap: coin.usd_market_cap || 0,
      source: 'coingecko',
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/ping');
      return response.ok;
    } catch {
      return false;
    }
  }
}

// CoinCap Provider (Fallback crypto)
class CoinCapProvider {
  name = 'coincap';
  priority = 2;

  async execute(coinId: string): Promise<CryptoPrice> {
    const response = await fetch(`https://api.coincap.io/v2/assets/${coinId}`);

    if (!response.ok) {
      throw new Error(`CoinCap returned ${response.status}`);
    }

    const data = await response.json() as any;
    const asset = data.data;

    return {
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      price: parseFloat(asset.priceUsd),
      change24h: parseFloat(asset.changePercent24Hr) || 0,
      marketCap: parseFloat(asset.marketCapUsd) || 0,
      source: 'coincap',
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('https://api.coincap.io/v2/assets/bitcoin');
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Iran Market Provider (TGJU)
class IranMarketProvider {
  name = 'tgju';
  priority = 1;

  async execute(): Promise<any> {
    const response = await fetch('https://api.tgju.org/v1/market/');

    if (!response.ok) {
      throw new Error(`TGJU returned ${response.status}`);
    }

    return await response.json();
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('https://api.tgju.org/v1/market/');
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Provider Chains
export function createCurrencyProvider(): MultiProvider<CurrencyRate[]> {
  const provider = new MultiProvider<CurrencyRate[]>();

  provider.addProvider({
    name: 'frankfurter',
    priority: 1,
    execute: async (base: string, targets: string[]) => {
      const p = new FrankfurterProvider();
      return p.execute(base, targets);
    },
    isAvailable: async () => {
      const p = new FrankfurterProvider();
      return p.isAvailable();
    },
  });

  provider.addProvider({
    name: 'exchangerate-api',
    priority: 2,
    execute: async (base: string, targets: string[]) => {
      const p = new ExchangeRateProvider();
      return p.execute(base, targets);
    },
    isAvailable: async () => {
      const p = new ExchangeRateProvider();
      return p.isAvailable();
    },
  });

  return provider;
}

export function createGoldProvider(): MultiProvider<GoldPrice[]> {
  const provider = new MultiProvider<GoldPrice[]>();

  provider.addProvider({
    name: 'metals-live',
    priority: 1,
    execute: async () => {
      const p = new MetalsProvider();
      return p.execute();
    },
    isAvailable: async () => {
      const p = new MetalsProvider();
      return p.isAvailable();
    },
  });

  return provider;
}

export function createCryptoProvider(): MultiProvider<CryptoPrice> {
  const provider = new MultiProvider<CryptoPrice>();

  provider.addProvider({
    name: 'coingecko',
    priority: 1,
    execute: async (coinId: string) => {
      const p = new CoinGeckoProvider();
      return p.execute(coinId);
    },
    isAvailable: async () => {
      const p = new CoinGeckoProvider();
      return p.isAvailable();
    },
  });

  provider.addProvider({
    name: 'coincap',
    priority: 2,
    execute: async (coinId: string) => {
      const p = new CoinCapProvider();
      return p.execute(coinId);
    },
    isAvailable: async () => {
      const p = new CoinCapProvider();
      return p.isAvailable();
    },
  });

  return provider;
}
