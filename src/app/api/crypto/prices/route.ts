import { NextResponse } from 'next/server';

// In-memory cache (survives across requests within the same Node process)
type PriceEntry = { usd: number; usd_24h_change?: number };

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

function getFromCache() {
  if (cachedData && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedData;
  }
  return null;
}

function setCache(data: Record<string, PriceEntry>) {
  cachedData = data;
  cacheTimestamp = Date.now();
}

function buildCoinGeckoUrl(apiKey: string) {
  const ids = COIN_IDS.join(',');
  return `https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&ids=${ids}&include_24hr_change=true&x_cg_demo_api_key=${apiKey}`;
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
  const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');

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

export async function GET() {
  const cacheHit = getFromCache();
  if (cacheHit) {
    return NextResponse.json(cacheHit);
  }

  const apiKey = process.env.COINGECKO_API_KEY;

  try {
    if (apiKey) {
      const data = await fetchFromCoinGecko(apiKey);
      setCache(data);
      return NextResponse.json(data);
    }

    console.warn('CoinGecko API key is not configured; using Binance fallback.');
  } catch (error) {
    console.warn('CoinGecko failed, falling back to Binance:', error);
  }

  try {
    const fallbackData = await fetchFromBinance();
    setCache(fallbackData);
    return NextResponse.json(fallbackData);
  } catch (error) {
    console.error('Error fetching crypto prices from all providers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market prices from CoinGecko and fallback providers' },
      { status: 500 }
    );
  }
}
