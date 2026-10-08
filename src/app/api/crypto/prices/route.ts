import { NextResponse } from 'next/server';
import { fetchCoinGeckoPrices, PriceEntry } from '@/lib/server/coinGeckoPrices';

let cachedData: Record<string, PriceEntry> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 120_000;

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

export async function GET() {
  const cacheHit = getFromCache();
  if (cacheHit) {
    return NextResponse.json(cacheHit);
  }

  try {
    const data = await fetchCoinGeckoPrices();
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
