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

// ─── Swap Modal State ───
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

export interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export const SWAP_ASSETS: SwapAsset[] = [
  { id: 'bitcoin', name: 'Bitcoin', ticker: 'BTC', logo: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png', price: 63492.5, balance: 1.512349 },
  { id: 'ethereum', name: 'Ethereum', ticker: 'ETH', logo: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png', price: 3452.8, balance: 10.845 },
  { id: 'solana', name: 'Solana', ticker: 'SOL', logo: 'https://assets.coingecko.com/coins/images/4128/large/solana.png', price: 148.25, balance: 500 },
  { id: 'litecoin', name: 'Litecoin', ticker: 'LTC', logo: 'https://assets.coingecko.com/coins/images/2/large/litecoin.png', price: 78.5, balance: 100 },
  { id: 'binancecoin', name: 'Binance Coin', ticker: 'BNB', logo: 'https://assets.coingecko.com/coins/images/825/large/binance-coin-logo.png', price: 580, balance: 20 },
  { id: 'tether', name: 'Tether', ticker: 'USDT', logo: 'https://assets.coingecko.com/coins/images/325/large/Tether-logo.png', price: 1.0, balance: 25000.5 },
  { id: 'dogecoin', name: 'Dogecoin', ticker: 'DOGE', logo: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png', price: 0.10, balance: 100000 },
  { id: 'chainlink', name: 'Chainlink', ticker: 'LINK', logo: 'https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png', price: 14.50, balance: 1000 },
];
