import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  fetchCoinGeckoPrices,
  REPORT_TICKER_TO_COIN_ID,
} from '@/lib/server/coinGeckoPrices';

export const dynamic = 'force-dynamic';

function hasValidServiceKey(request: Request, expectedKey: string) {
  const providedKey = request.headers.get('x-crypgo-service-key') || '';
  const expected = Buffer.from(expectedKey);
  const provided = Buffer.from(providedKey);
  return expected.length > 0
    && provided.length === expected.length
    && timingSafeEqual(provided, expected);
}

export async function GET(request: Request) {
  const serviceKey = process.env.CRYPGO_REPORT_PRICE_SERVICE_KEY || '';
  if (!serviceKey) {
    return NextResponse.json(
      { error: 'Report price service is not configured' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (!hasValidServiceKey(request, serviceKey)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const coinPrices = await fetchCoinGeckoPrices();
    const prices = Object.fromEntries(
      Object.entries(REPORT_TICKER_TO_COIN_ID).map(([ticker, coinId]) => [
        ticker,
        Number(coinPrices[coinId].usd),
      ]),
    );

    if (Object.values(prices).some((price) => !Number.isFinite(price) || price <= 0)) {
      throw new Error('CoinGecko returned incomplete report prices');
    }

    return NextResponse.json(
      {
        source: 'coingecko',
        fetched_at: new Date().toISOString(),
        prices,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    console.error('Report price snapshot request failed:', error);
    return NextResponse.json(
      { error: 'Report prices are temporarily unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
