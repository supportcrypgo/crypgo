import { NextResponse } from 'next/server';
import { fetchCoinGeckoBitcoinHistoricalChanges } from '@/lib/server/coinGeckoPrices';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const changes = await fetchCoinGeckoBitcoinHistoricalChanges();
    return NextResponse.json(changes, {
      headers: { 'Cache-Control': 'private, max-age=120' },
    });
  } catch (error) {
    console.error('Error fetching Bitcoin historical price changes:', error);
    return NextResponse.json(
      { error: 'Historical crypto prices are temporarily unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
