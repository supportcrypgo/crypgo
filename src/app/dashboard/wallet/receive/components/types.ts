// ─── Receive Page Types ───

export interface NetworkOption {
  id: string;
  name: string;           // "Bitcoin", "Ethereum", "Tron", etc.
  shortName?: string;     // "ERC-20", "BEP-20", "TRC-20", "SPL"
  badge?: string;         // "Recommended" badge
  addressPrefix: string;  // Address prefix for generated address
  addressCharset: string; // Charset for address generation
  addressLength: number;  // Total address length
  addressType: 'bech32' | 'hex' | 'base58';
  memoRequired: boolean;  // e.g. XRP destination tag
  memoLabel?: string;     // "Destination Tag" etc.
  minDeposit: string;
  minDepositInUsd?: string;
  confirmations: number;
  confirmationsLabel?: string; // "Network confirmations" vs "Block confirmations"
  estimatedArrival: string;
  feePercentage: number;  // Network fee as percentage (e.g., 0.01 for 1%)
  explorerUrl: string;
  warning: string;        // Asset/network specific warning
}

export interface ReceiveAssetInfo {
  ticker: string;
  name: string;
  logo: string;
  networks: NetworkOption[];
  defaultNetworkIndex?: number;
}

export interface ReceiveAddressInfo {
  address: string;
  memo?: string;
  network: NetworkOption;
  asset: ReceiveAssetInfo;
  expiresAt?: string;   // Address rotation countdown
}

export interface RecentDeposit {
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