// ─── Send Page Types ───

export interface NetworkOption {
  id: string;
  name: string;
  shortName?: string;
  badge?: string;
  addressPrefix: string;
  addressCharset: string;
  addressLength: number;
  addressType: 'bech32' | 'hex' | 'base58';
  memoRequired: boolean;
  memoLabel?: string;
  minDeposit: string;
  minDepositInUsd?: string;
  confirmations: number;
  confirmationsLabel?: string;
  estimatedArrival: string;
  feePercentage: number; // Network fee as percentage (e.g., 0.01 for 1%)
  explorerUrl: string;
  warning: string;
}

export interface SendAssetInfo {
  ticker: string;
  name: string;
  logo: string;
  networks: NetworkOption[];
  defaultNetworkIndex?: number;
  balance?: string; // User's available balance
}

export interface RecipientInfo {
  isValid: boolean;
  isValidNetwork: boolean;
  address: string;
  error?: string;
}

export interface RecentSend {
  id: string;
  asset: string;
  ticker: string;
  amount: number;
  usdValue: number;
  status: 'pending' | 'completed';
  network: string;
  dateTime: string;
  txId: string;
}