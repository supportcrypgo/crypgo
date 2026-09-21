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

const BINANCE_SYMBOL_MAP: Record<string, string> = {
  bitcoin: 'BTCUSDT',
  ethereum: 'ETHUSDT',
  binancecoin: 'BNBUSDT',
  solana: 'SOLUSDT',
  litecoin: 'LTCUSDT',
  tether: 'USDTUSDT',
  'usd-coin': 'USDCUSDT',
  dogecoin: 'DOGEUSDT',
  cardano: 'ADAUSDT',
  polkadot: 'DOTUSDT',
  chainlink: 'LINKUSDT',
  ripple: 'XRPUSDT',
};

const COINBASE_SYMBOL_MAP: Record<string, string> = {
  bitcoin: 'BTC-USD',
  ethereum: 'ETH-USD',
  binancecoin: 'BNB-USD',
  solana: 'SOL-USD',
  litecoin: 'LTC-USD',
  tether: 'USDT-USD',
  'usd-coin': 'USDC-USD',
  dogecoin: 'DOGE-USD',
  cardano: 'ADA-USD',
  polkadot: 'DOT-USD',
  chainlink: 'LINK-USD',
  ripple: 'XRP-USD',
};

const SAFE_FALLBACK_PRICES: Record<string, { usd: number; usd_24h_change?: number }> = {
  bitcoin: { usd: 0, usd_24h_change: 0 },
  ethereum: { usd: 0, usd_24h_change: 0 },
  binancecoin: { usd: 0, usd_24h_change: 0 },
  solana: { usd: 0, usd_24h_change: 0 },
  litecoin: { usd: 0, usd_24h_change: 0 },
  tether: { usd: 1, usd_24h_change: 0 },
  'usd-coin': { usd: 1, usd_24h_change: 0 },
  dogecoin: { usd: 0, usd_24h_change: 0 },
  cardano: { usd: 0, usd_24h_change: 0 },
  polkadot: { usd: 0, usd_24h_change: 0 },
  chainlink: { usd: 0, usd_24h_change: 0 },
  ripple: { usd: 0, usd_24h_change: 0 },
};

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

function buildCoinGeckoUrl(apiKey: string) {
  const ids = COIN_IDS.join(',');
  const authParam = apiKey.startsWith('CG-')
    ? `x_cg_pro_api_key=${encodeURIComponent(apiKey)}`
    : `x_cg_demo_api_key=${encodeURIComponent(apiKey)}`;
  return `https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&ids=${ids}&include_24hr_change=true&${authParam}`;
}

function getCoinGeckoApiKeys(): string[] {
  const rawKeys = process.env.COINGECKO_API_KEYS || process.env.COINGECKO_API_KEY || '';
  return rawKeys
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
}

async function fetchFromCoinGecko(apiKey: string): Promise<Record<string, PriceEntry>> {
  const response = await fetch(buildCoinGeckoUrl(apiKey), {
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

function normalizeBinanceData(raw: any[]): Record<string, PriceEntry> {
  const payload: Record<string, PriceEntry> = {};

  for (const [coinId, symbol] of Object.entries(BINANCE_SYMBOL_MAP)) {
    const match = raw.find((entry) => entry.symbol === symbol);

    if (match) {
      payload[coinId] = {
        usd: Number(match.lastPrice),
        usd_24h_change: Number(match.priceChangePercent),
      };
    }
  }

  return payload;
}

async function fetchFromBinance(): Promise<Record<string, PriceEntry>> {
  const response = await fetch('https://api.binance.com/api/v3/ticker/24hr', {
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Binance API responded with status ${response.status}`);
  }

  const raw = await response.json();

  if (!Array.isArray(raw)) {
    throw new Error('Binance returned an invalid response');
  }

  const normalized = normalizeBinanceData(raw);

  if (Object.keys(normalized).length === 0) {
    throw new Error('Binance fallback did not return any matching symbols');
  }

  return normalized;
}

async function fetchFromCoinbase(): Promise<Record<string, PriceEntry>> {
  const results = await Promise.allSettled(
    Object.entries(COINBASE_SYMBOL_MAP).map(async ([coinId, symbol]) => {
      const [spotResponse, statsResponse] = await Promise.all([
        fetch(`https://api.coinbase.com/v2/prices/${symbol}/spot`, {
          signal: AbortSignal.timeout(8000),
        }),
        fetch(`https://api.exchange.coinbase.com/products/${symbol}/stats`, {
          signal: AbortSignal.timeout(8000),
        }),
      ]);
      if (!spotResponse.ok) throw new Error(`Coinbase returned ${spotResponse.status} for ${symbol}`);
      const payload = await spotResponse.json();
      const stats = statsResponse.ok ? await statsResponse.json() : null;
      const usd = Number(payload?.data?.amount);
      const open = Number(stats?.open);
      const usd24hChange = open > 0 ? ((usd - open) / open) * 100 : 0;
      if (!Number.isFinite(usd) || usd <= 0) throw new Error(`Coinbase returned an invalid price for ${symbol}`);
      return [coinId, { usd, usd_24h_change: usd24hChange }] as const;
    })
  );
  const entries = results.flatMap((result) => (
    result.status === 'fulfilled'
      ? [result.value as readonly [string, PriceEntry]]
      : []
  ));
  const payload = Object.fromEntries(entries);
  if (!payload.bitcoin) throw new Error('Coinbase did not return a BTC price');
  const btc = payload.bitcoin;
  try {
    const candlesResponse = await fetch(
      'https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400',
      { signal: AbortSignal.timeout(8000) }
    );
    if (candlesResponse.ok) {
      const candles = await candlesResponse.json() as number[][];
      const current = Number(btc.usd);
      const priceAt = (daysAgo: number) => Number(candles.find((c) => Number(c[0]) <= (Date.now() / 1000) - daysAgo * 86400)?.[4]);
      const price7d = priceAt(7);
      const price30d = priceAt(30);
      if (price7d > 0) btc.usd_7d_change = ((current - price7d) / price7d) * 100;
      if (price30d > 0) btc.usd_30d_change = ((current - price30d) / price30d) * 100;
    }
  } catch {
    // Keep the live spot and 24-hour values if historical candles are unavailable.
  }
  return { ...SAFE_FALLBACK_PRICES, ...payload };
}

async function fetchFromCoinGeckoWithFallback(apiKeys: string[]): Promise<Record<string, PriceEntry>> {
  if (apiKeys.length === 0) {
    throw new Error('CoinGecko API keys are not configured');
  }

  let lastError: unknown;

  for (let index = 0; index < apiKeys.length; index += 1) {
    const apiKey = apiKeys[index];

    try {
      return await fetchFromCoinGecko(apiKey);
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
    if (apiKeys.length > 0) {
      const data = await fetchFromCoinGeckoWithFallback(apiKeys);
      if (!COIN_IDS.every((coinId) => data[coinId] && Number(data[coinId].usd) > 0)) {
        throw new Error('CoinGecko returned incomplete or zero-valued prices');
      }
      setCache(data);
      return NextResponse.json(data);
    }

    console.warn('CoinGecko API keys are not configured; using Binance fallback.');
  } catch (error) {
    console.warn('All CoinGecko keys failed, falling back to Binance:', error);
  }

  try {
    const fallbackData = await fetchFromBinance();
    setCache(fallbackData);
    return NextResponse.json(fallbackData);
  } catch (error) {
    console.warn('Binance fallback failed, trying Coinbase:', error);
  }

  try {
    const fallbackData = await fetchFromCoinbase();
    setCache(fallbackData);
    return NextResponse.json(fallbackData);
  } catch (error) {
    console.error('Error fetching crypto prices from all providers:', error);
    return NextResponse.json(
      { ...SAFE_FALLBACK_PRICES, error: 'Live price providers are unavailable' },
      { status: 503 }
    );
  }
}
