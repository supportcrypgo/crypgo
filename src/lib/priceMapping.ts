import type { Prices } from '@/app/dashboard/components/types';

/**
 * Shared mapping from asset ticker to CoinGecko price key.
 * Single source of truth for live price enrichment across the app.
 */
export const TICKER_TO_COINGECKO_KEY: Record<string, keyof Prices | string> = {
  BTC: 'bitcoin',
  BNB: 'binancecoin',
  ETH: 'ethereum',
  SOL: 'solana',
  LTC: 'litecoin',
  USDT: 'tether',
  DOGE: 'dogecoin',
  LINK: 'chainlink',
  ADA: 'cardano',
  DOT: 'polkadot',
  XRP: 'ripple',
};