import { NextResponse } from 'next/server';

// In-memory cache (survives across requests within the same Node process)
type PriceEntry = { usd: number; usd_24h_change?: number; usd_7d_change?: number; usd_30d_change?: number };

let cachedData: Record<string, PriceEntry> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 120_000;
const COIN_IDS = [
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

function getFromCache() {
  const hasLiveBitcoinPrice = Number(cachedData?.bitcoin?.usd) > 0;
  if (cachedData && hasLiveBitcoinPrice && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedData;
  }
  if (cachedData && !hasLiveBitcoinPrice) {
    cachedData = null;
    cacheTimestamp = 0;
  }
  return null;
}

function setCache(data: Record<string, PriceEntry>) {
  cachedData = data;
  cacheTimestamp = Date.now();
}

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

function buildCoinGeckoUrl(plan: CoinGeckoPlan) {
  const ids = COIN_IDS.join(',');
  return `${getCoinGeckoApiRoot(plan)}/simple/price?vs_currencies=usd&ids=${ids}&include_24hr_change=true`;
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
  const response = await fetch(buildCoinGeckoUrl(plan), {
    headers: getCoinGeckoHeaders(apiKey, plan),
    next: { revalidate: 120 },
  });

  if (!response.ok) {
    throw new Error(`CoinGecko API responded with status ${response.status}`);
  }

  const data = await response.json();

  if (!data || typeof data !== 'object') {
    throw new Error('CoinGecko returned an invalid response');
  }

  return data as Record<string, PriceEntry>;
}

async function fetchBitcoinHistoricalChanges(apiKeys: string[], plan: CoinGeckoPlan): Promise<{ usd_7d_change?: number; usd_30d_change?: number }> {
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

async function fetchFromCoinGeckoWithFallback(apiKeys: string[], plan: CoinGeckoPlan): Promise<Record<string, PriceEntry>> {
  if (apiKeys.length === 0) {
    throw new Error('CoinGecko API keys are not configured');
  }

  let lastError: unknown;

  for (let index = 0; index < apiKeys.length; index += 1) {
    const apiKey = apiKeys[index];

    try {
      const data = await fetchFromCoinGecko(apiKey, plan);
      if (!COIN_IDS.every((coinId) => data[coinId] && Number(data[coinId].usd) > 0)) {
        throw new Error('CoinGecko returned incomplete or zero-valued prices');
      }

      const historicalChanges = await fetchBitcoinHistoricalChanges(apiKeys, plan);
      if (data.bitcoin) {
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

  throw lastError ?? new Error('All configured CoinGecko API keys failed');
}

export async function GET() {
  const cacheHit = getFromCache();
  if (cacheHit) {
    return NextResponse.json(cacheHit);
  }

  const apiKeys = getCoinGeckoApiKeys();

  try {
    const plan = getCoinGeckoPlan();
    const data = await fetchFromCoinGeckoWithFallback(apiKeys, plan);
    setCache(data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching crypto prices from CoinGecko:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'CoinGecko price service is unavailable' },
      { status: 503 }
    );
  }
}
