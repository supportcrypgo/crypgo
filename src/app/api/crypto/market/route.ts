import { NextResponse } from 'next/server';

export interface CoinMarketData {
  id: string;
  name: string;
  symbol: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
  sparkline_in_7d: { price: number[] } | null;
}

const CACHE_TTL_MS = 120_000;
const COIN_IDS = [
  'bitcoin',
  'ethereum',
  'binancecoin',
  'solana',
  'litecoin',
  'dogecoin',
  'tether',
  'usd-coin',
  'ripple',
  'cardano',
  'polkadot',
  'chainlink',
  'bitcoin-cash',
];

const BINANCE_SYMBOL_MAP: Record<string, string> = {
  bitcoin: 'BTCUSDT',
  ethereum: 'ETHUSDT',
  binancecoin: 'BNBUSDT',
  solana: 'SOLUSDT',
  litecoin: 'LTCUSDT',
  dogecoin: 'DOGEUSDT',
  tether: 'USDTUSDT',
  'usd-coin': 'USDCUSDT',
  ripple: 'XRPUSDT',
  cardano: 'ADAUSDT',
  polkadot: 'DOTUSDT',
  chainlink: 'LINKUSDT',
  'bitcoin-cash': 'BCHUSDT',
};

const FALLBACK_METADATA: Record<string, { name: string; symbol: string; image: string }> = {
  bitcoin: { name: 'Bitcoin', symbol: 'BTC', image: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png' },
  ethereum: { name: 'Ethereum', symbol: 'ETH', image: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png' },
  binancecoin: { name: 'Binance Coin', symbol: 'BNB', image: 'https://assets.coingecko.com/coins/images/825/large/binance-coin-logo.png' },
  solana: { name: 'Solana', symbol: 'SOL', image: 'https://assets.coingecko.com/coins/images/4128/large/solana.png' },
  litecoin: { name: 'Litecoin', symbol: 'LTC', image: 'https://assets.coingecko.com/coins/images/2/large/litecoin.png' },
  dogecoin: { name: 'Dogecoin', symbol: 'DOGE', image: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png' },
  tether: { name: 'Tether', symbol: 'USDT', image: 'https://assets.coingecko.com/coins/images/325/large/Tether-logo.png' },
  'usd-coin': { name: 'USD Coin', symbol: 'USDC', image: 'https://assets.coingecko.com/coins/images/6319/large/usdc.png' },
  ripple: { name: 'XRP', symbol: 'XRP', image: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png' },
  cardano: { name: 'Cardano', symbol: 'ADA', image: 'https://assets.coingecko.com/coins/images/975/large/cardano.png' },
  polkadot: { name: 'Polkadot', symbol: 'DOT', image: 'https://assets.coingecko.com/coins/images/12171/large/polkadot.png' },
  chainlink: { name: 'Chainlink', symbol: 'LINK', image: 'https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png' },
  'bitcoin-cash': { name: 'Bitcoin Cash', symbol: 'BCH', image: 'https://assets.coingecko.com/coins/images/780/large/bitcoin-cash.png' },
};

let cachedData: CoinMarketData[] | null = null;
let cacheTimestamp = 0;

function getFromCache() {
  if (cachedData && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedData;
  }
  return null;
}

function setCache(data: CoinMarketData[]) {
  cachedData = data;
  cacheTimestamp = Date.now();
}

function getCoinGeckoApiKeys(): string[] {
  const rawKeys = process.env.COINGECKO_API_KEYS || process.env.COINGECKO_API_KEY || '';
  return rawKeys
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
}

async function fetchFromCoinGecko(apiKey: string): Promise<CoinMarketData[]> {
  const ids = COIN_IDS.join(',');
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=true&price_change_percentage=24h&x_cg_demo_api_key=${apiKey}`;

  const response = await fetch(url, {
    next: { revalidate: 120 },
  });

  if (!response.ok) {
    throw new Error(`CoinGecko API responded with status ${response.status}`);
  }

  const data: CoinMarketData[] = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('CoinGecko returned an invalid response');
  }

  return data;
}

async function fetchFromBinance(): Promise<CoinMarketData[]> {
  const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');

  if (!response.ok) {
    throw new Error(`Binance API responded with status ${response.status}`);
  }

  const raw = await response.json();

  if (!Array.isArray(raw)) {
    throw new Error('Binance returned an invalid response');
  }

  return COIN_IDS.map((coinId) => {
    const metadata = FALLBACK_METADATA[coinId];
    const match = raw.find((entry) => entry.symbol === BINANCE_SYMBOL_MAP[coinId]);

    return {
      id: coinId,
      name: metadata?.name ?? coinId,
      symbol: metadata?.symbol ?? coinId.toUpperCase(),
      image: metadata?.image ?? '',
      current_price: match ? Number(match.lastPrice) : 0,
      price_change_percentage_24h: match ? Number(match.priceChangePercent) : 0,
      market_cap: 0,
      total_volume: match ? Number(match.quoteVolume) : 0,
      sparkline_in_7d: null,
    };
  });
}

async function fetchFromCoinGeckoWithFallback(apiKeys: string[]): Promise<CoinMarketData[]> {
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
    console.error('Error fetching crypto market data from all providers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market data from CoinGecko and fallback providers' },
      { status: 500 }
    );
  }
}
