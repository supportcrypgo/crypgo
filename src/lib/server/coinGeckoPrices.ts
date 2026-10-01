export type PriceEntry = {
  usd: number;
  usd_24h_change?: number;
  usd_7d_change?: number;
  usd_30d_change?: number;
};

export const COIN_IDS = [
  'bitcoin',
  'ethereum',
  'binancecoin',
  'solana',
  'litecoin',
  'tether',
  'usd-coin',
  'dogecoin',
  'cardano',
  'polkadot',
  'chainlink',
  'ripple',
];

export const REPORT_TICKER_TO_COIN_ID = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  BNB: 'binancecoin',
  SOL: 'solana',
  LTC: 'litecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOT: 'polkadot',
  DOGE: 'dogecoin',
  LINK: 'chainlink',
} as const;

type CoinGeckoPlan = 'demo' | 'pro';

function getCoinGeckoPlan(): CoinGeckoPlan {
  const plan = (process.env.COINGECKO_API_PLAN || 'demo').trim().toLowerCase();
  if (plan !== 'demo' && plan !== 'pro') {
    throw new Error('COINGECKO_API_PLAN must be either "demo" or "pro"');
  }
  return plan;
}

function getCoinGeckoApiRoot(plan: CoinGeckoPlan) {
  return plan === 'pro'
    ? 'https://pro-api.coingecko.com/api/v3'
    : 'https://api.coingecko.com/api/v3';
}

function getCoinGeckoHeaders(apiKey: string, plan: CoinGeckoPlan) {
  return {
    Accept: 'application/json',
    [plan === 'pro' ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key']: apiKey,
  };
}

function getCoinGeckoApiKeys(): string[] {
  const rawKeys = process.env.COINGECKO_API_KEYS || process.env.COINGECKO_API_KEY || '';
  const keys = rawKeys
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
  return keys.filter((key, index) => keys.indexOf(key) === index);
}

async function fetchFromCoinGecko(apiKey: string, plan: CoinGeckoPlan): Promise<Record<string, PriceEntry>> {
  const ids = COIN_IDS.join(',');
  const url = `${getCoinGeckoApiRoot(plan)}/simple/price?vs_currencies=usd&ids=${ids}&include_24hr_change=true`;
  const response = await fetch(url, {
    headers: getCoinGeckoHeaders(apiKey, plan),
    next: { revalidate: 120 },
  });

  if (!response.ok) {
    throw new Error(`CoinGecko API responded with status ${response.status}`);
  }

  const data = await response.json();
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('CoinGecko returned an invalid response');
  }

  return data as Record<string, PriceEntry>;
}

async function fetchBitcoinHistoricalChanges(
  apiKeys: string[],
  plan: CoinGeckoPlan,
): Promise<{ usd_7d_change?: number; usd_30d_change?: number }> {
  for (const apiKey of apiKeys) {
    try {
      const url = `${getCoinGeckoApiRoot(plan)}/coins/bitcoin/market_chart?vs_currency=usd&days=30&interval=daily`;
      const response = await fetch(url, {
        headers: getCoinGeckoHeaders(apiKey, plan),
        next: { revalidate: 120 },
      });
      if (!response.ok) continue;

      const payload = await response.json();
      if (!Array.isArray(payload?.prices) || payload.prices.length === 0) continue;

      const prices = payload.prices as number[][];
      const nowValue = Number(prices[prices.length - 1]?.[1]);
      const value7dAgo = Number(prices[Math.max(0, prices.length - 8)]?.[1]);
      const value30dAgo = Number(prices[Math.max(0, prices.length - 31)]?.[1]);
      const changes: { usd_7d_change?: number; usd_30d_change?: number } = {};
      if (Number.isFinite(nowValue) && Number.isFinite(value7dAgo) && value7dAgo > 0) {
        changes.usd_7d_change = ((nowValue - value7dAgo) / value7dAgo) * 100;
      }
      if (Number.isFinite(nowValue) && Number.isFinite(value30dAgo) && value30dAgo > 0) {
        changes.usd_30d_change = ((nowValue - value30dAgo) / value30dAgo) * 100;
      }
      if (changes.usd_7d_change !== undefined || changes.usd_30d_change !== undefined) {
        return changes;
      }
    } catch {
      // Try the next CoinGecko key.
    }
  }

  return {};
}

export async function fetchCoinGeckoPrices(options: { includeHistoricalChanges?: boolean } = {}) {
  const apiKeys = getCoinGeckoApiKeys();
  if (apiKeys.length === 0) {
    throw new Error('CoinGecko API keys are not configured');
  }

  const plan = getCoinGeckoPlan();
  let lastError: unknown;

  for (let index = 0; index < apiKeys.length; index += 1) {
    try {
      const data = await fetchFromCoinGecko(apiKeys[index], plan);
      if (!COIN_IDS.every((coinId) => data[coinId] && Number(data[coinId].usd) > 0)) {
        throw new Error('CoinGecko returned incomplete or zero-valued prices');
      }

      if (options.includeHistoricalChanges) {
        const historicalChanges = await fetchBitcoinHistoricalChanges(apiKeys, plan);
        data.bitcoin = {
          ...data.bitcoin,
          usd_7d_change: data.bitcoin.usd_7d_change ?? historicalChanges.usd_7d_change,
          usd_30d_change: data.bitcoin.usd_30d_change ?? historicalChanges.usd_30d_change,
        };
      }
      return data;
    } catch (error) {
      lastError = error;
      console.warn(`CoinGecko key ${index + 1}/${apiKeys.length} failed, trying next key...`, error);
    }
  }

  throw lastError ?? new Error('All configured CoinGecko keys failed');
}
