import { UnifiedUser } from '@/types/unified';

// ─── Asset & Portfolio Types ───

export interface Asset {
  id: string;
  name: string;
  ticker: string;
  logo: string;
  quantity: number;
  availableQuantity: number;
  price: number;
  value: number;
  change24h: number;
  percentage: number;
}

export interface Prices {
  bitcoin?: { usd: number; usd_24h_change?: number };
  ethereum?: { usd: number; usd_24h_change?: number };
  solana?: { usd: number; usd_24h_change?: number };
  litecoin?: { usd: number; usd_24h_change?: number };
  binancecoin?: { usd: number; usd_24h_change?: number };
  tether?: { usd: number; usd_24h_change?: number };
  'usd-coin'?: { usd: number; usd_24h_change?: number };
  dogecoin?: { usd: number; usd_24h_change?: number };
  cardano?: { usd: number; usd_24h_change?: number };
  polkadot?: { usd: number; usd_24h_change?: number };
  chainlink?: { usd: number; usd_24h_change?: number };
  ripple?: { usd: number; usd_24h_change?: number };
  // Add more as needed
}

// Re-export unified asset config for Dashboard/Portfolio
export { ASSET_CONFIG } from '@/data/assets';

// ─── Onboarding & Security Types ───

export interface NotificationPreferences {
  portfolio_activity: boolean;
  security_alerts: boolean;
  product_updates: boolean;
  marketing: boolean;
}

export interface OnboardingFlowUser extends UnifiedUser {
  notificationPreferences?: NotificationPreferences;
}

export interface LoginDetectionData {
  userName: string;
  location: string;
  ipAddress: string;
  device: string;
  timestamp: string;
}
