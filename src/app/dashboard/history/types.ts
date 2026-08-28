export interface Transaction {
  id: string;
  dateTime: string; // ISO string
  type: TransactionType;
  asset: string;
  amountPositive: boolean; // true = received/bought, false = sent/sold
  amount: number;
  price: number; // USD price at time of transaction
  totalValue: number; // amount * price
  status: TransactionStatus;
  txId: string;

  // === Counterparty routing ===
  counterpartyType: CounterpartyType;

  // External send/receive fields (when counterpartyType === 'send' | 'receive')
  walletAddress?: string;
  fee?: number;       // network fee — only for sends
  feeAsset?: string;  // asset the fee was paid in — only for sends
  network?: string;   // "Bitcoin", "Ethereum", "Solana", etc.
}

export type CounterpartyType = 'send' | 'receive';

export type TransactionType = 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'send' | 'receive';

export type TransactionStatus = 'completed' | 'pending' | 'failed' | 'cancelled';

export interface SummaryMetrics {
  totalVolume: number;
  totalTransactions: number;
  completionRate: number;
}

export interface VolumeByType {
  type: TransactionType;
  volume: number;
  percentage: number;
}

export interface TransactionFilterState {
  dateFrom: string;
  dateTo: string;
  asset: string;
  type: string;
  status: string;
}

export type TransactionTabType = 'all' | 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'send' | 'receive';

export interface TransactionContextType {
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  filters: TransactionFilterState;
  setFilters: (filters: TransactionFilterState) => void;
  activeTab: TransactionTabType;
  setActiveTab: (tab: TransactionTabType) => void;
  loading: boolean;
  summaryMetrics: SummaryMetrics;
  volumeByType: VolumeByType[];
  assets: string[];
  getTransactionById: (id: string) => Transaction | undefined;
}
