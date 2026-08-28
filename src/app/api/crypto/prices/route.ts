import { NextResponse } from 'next/server';

// In-memory cache (survives across requests within the same Node process)
let cachedData: Record<string, { usd: number; usd_24h_change: number }> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds
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
  if (cachedData && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedData;
  }
  return null;
}

function setCache(data: Record<string, { usd: number; usd_24h_change: number }>) {
  cachedData = data;
  cacheTimestamp = Date.now();
}

export async function GET() {
  const cacheHit = getFromCache();
  if (cacheHit) {
    return NextResponse.json(cacheHit);
  }

  const apiKey = process.env.COINGECKO_API_KEY;
  if (!apiKey) {
    console.error('CoinGecko API key is not configured');
    return NextResponse.json({ error: 'CoinGecko API key is not configured' }, { status: 500 });
  }

  try {
    const ids = COIN_IDS.join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&ids=${ids}&include_24hr_change=true&x_cg_demo_api_key=${apiKey}`;

    const response = await fetch(url, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API responded with status ${response.status}`);
    }

    const data = await response.json();
    setCache(data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching crypto prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market prices from CoinGecko' },
      { status: 500 }
    );
  }
}
