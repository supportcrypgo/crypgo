// ─── Enums ───
export type UserRole = 'admin' | 'trader' | 'merchant';
export type UserStatus = 'active' | 'suspended' | 'pending';
export type AssetTicker = 'BTC' | 'ETH' | 'USDT' | 'BNB' | 'SOL' | 'LTC' | 'XRP' | 'ADA' | 'DOT' | 'DOGE' | 'LINK';
export type PaymentMethod =
  | 'bank_transfer'
  | 'paypal'
  | 'wise'
  | 'revolut'
  | 'cash_deposit'
  | 'apple_pay'
  | 'google_pay';
export type Currency = 'USD' | 'EUR' | 'GBP' | 'NGN' | 'BRL' | 'JPY' | 'AUD' | 'CAD';
export type TransactionType = 'deposit' | 'withdrawal' | 'transfer' | 'send' | 'receive' | 'swap';
export type TransactionStatus = 'completed' | 'pending' | 'failed' | 'cancelled';

// ─── User (originates from Admin profile creation) ───
export interface UnifiedUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  dateOfBirth?: string;
  password: string;
  avatarInitials: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  lastLoginAt: string;
}

// ─── Wallet ───
export interface UnifiedWalletAsset {
  id: string;
  userId: string;
  ticker: AssetTicker;
  name: string;
  logo: string;
  quantity: number;
  availableQuantity: number;
  lockedQuantity: number;
  price: number;
  value: number;
  change24h: number;
  percentage: number;
}

export interface UnifiedWalletSummary {
  totalBalance: number;
  availableBalance: number;
  lockedBalance: number;
  change24h: number;
  change24hPercentage: number;
}

// ─── Transactions ───
export interface UnifiedTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  asset: AssetTicker;
  amount: number;
  price: number;
  totalValue: number;
  status: TransactionStatus;
  counterpartyType: 'external' | 'internal';
  counterpartyId?: string;
  counterpartyName?: string;
  paymentMethod?: PaymentMethod;
  orderId?: string;
  walletAddress?: string;
  fee?: number;
  feeAsset?: AssetTicker;
  network?: string;
  description?: string;
  createdAt: string;
}

// ─── History Summary ───
export interface UnifiedSummaryMetrics {
  totalVolume: number;
  totalTransactions: number;
  completionRate: number;
}

// ─── Profile (as seen by the user) ───
export interface UnifiedPublicProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  dateOfBirth?: string;
  avatarInitials: string;
  role: UserRole;
  emailVerified: boolean;
  phoneVerified: boolean;
  memberSince: string;
}

// ─── Historical Snapshots (Phase 2) ───
export interface SnapshotAssetBreakdown {
  ticker: AssetTicker;
  quantity: number;
  price: number;
  value: number;
}

export interface UserHistoricalSnapshot {
  id: string;
  userId: string;
  timestamp: string; // ISO 8601
  totalBalance: number;
  assetBreakdown: SnapshotAssetBreakdown[];
  performance24h?: number;   // percentage change vs 24h ago
  performance7d?: number;    // percentage change vs 7 days ago
  performance30d?: number;   // percentage change vs 30 days ago
}
