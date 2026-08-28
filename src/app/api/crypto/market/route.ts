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

export async function GET() {
  const apiKey = process.env.COINGECKO_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key not configured' },
      { status: 500 }
    );
  }

  try {
    const ids = COIN_IDS.join(',');
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=true&price_change_percentage=24h&x_cg_demo_api_key=${apiKey}`;

    const response = await fetch(url, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API responded with status ${response.status}`);
    }

    const data: CoinMarketData[] = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching crypto market data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market data' },
      { status: 500 }
    );
  }
}