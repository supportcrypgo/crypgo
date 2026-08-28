// ─── Trade Modes ───
export type TradeMode = 'instant' | 'limit-order';

// ─── Swap Assets ───
export interface SwapAsset {
  id: string;
  name: string;
  ticker: string;
  logo: string;
  price: number;
  balance: number;
}

// ─── Quote / Calculation Results ───
export interface SwapQuote {
  rate: number;
  fee: number;
  feeAssetTicker: string;
  receiveAmount: number;
  minimumReceived: number;
  priceImpact: number;
  route: string;
}

// ─── Swap State ───
export interface SwapState {
  tradeMode: TradeMode;
  payAsset: SwapAsset | null;
  receiveAsset: SwapAsset | null;
  payAmount: string;
  receiveAmount: string;
  slippage: number;
  isCalculating: boolean;
  quote: SwapQuote | null;
  isValid: boolean;
}

// ─── QuickSwap (simulated instant trade) ───
export interface QuickSwapResult {
  txId: string;
  payTicker: string;
  payAmount: number;
  receiveTicker: string;
  receiveAmount: number;
  rate: string;
  fee: number;
  date: string;
}

// ─── Tooltip option used in calculation rows ───
export interface CalcRow {
  id: string;
  label: string;
  value: string;
  info?: string;
  warning?: boolean;
}

// Re-export unified swap assets
export { SWAP_ASSETS } from '@/data/assets';