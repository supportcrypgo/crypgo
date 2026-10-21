import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 21_600 },
    });
    if (!response.ok) {
      throw new Error(`Exchange-rate service responded with status ${response.status}`);
    }

    const data = await response.json();
    if (data?.result !== 'success' || !data?.rates || typeof data.rates !== 'object') {
      throw new Error('Exchange-rate service returned invalid data');
    }

    const rates: Record<string, number> = {};
    for (const [currency, rawRate] of Object.entries(data.rates as Record<string, unknown>)) {
      const rate = Number(rawRate);
      if (/^[A-Z]{3}$/.test(currency) && Number.isFinite(rate) && rate > 0) {
        rates[currency] = rate;
      }
    }
    if (!rates.USD) {
      throw new Error('Exchange-rate service did not return a valid USD rate');
    }

    return NextResponse.json({ base: 'USD', rates, updatedAt: data.time_last_update_utc });
  } catch (error) {
    console.error('Failed to load fiat exchange rates:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Exchange-rate service is unavailable' },
      { status: 503 },
    );
  }
}
