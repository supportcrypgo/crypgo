import {
  UnifiedUser,
  UnifiedWalletAsset,
  UnifiedTransaction,
  UserHistoricalSnapshot,
  SnapshotAssetBreakdown,
} from '@/types/unified';
import { Prices } from '@/app/dashboard/components/types';
import { USE_FIXTURES } from '@/lib/dataSource';

// ─── 1. Seed Users (migrated from admin/mockData.ts) ───
export const SEED_USERS: UnifiedUser[] = []

// ─── 2. Wallet Assets (migrated from wallet/types.ts + linked to users) ───
// Prices updated to ~July 2026 market levels. These would be updated by a live price feed API.
export const SEED_WALLET_ASSETS: UnifiedWalletAsset[] = []

// ─── 3. Transactions (migrated from history/mockData.ts patterns + wallet MOCK_RECENT_TRANSACTIONS) ───
export const SEED_TRANSACTIONS: UnifiedTransaction[] = []

// ─── Helper functions (using fixtures only in dev) ───

export function getUserById(id: string): UnifiedUser | undefined {
  if (!USE_FIXTURES) return undefined;
  return SEED_USERS.find((u) => u.id === id);
}

export function getWalletForUser(userId: string): UnifiedWalletAsset[] {
  if (!USE_FIXTURES) return [];
  return SEED_WALLET_ASSETS.filter((w) => w.userId === userId);
}

export function getTransactionsForUser(userId: string): UnifiedTransaction[] {
  if (!USE_FIXTURES) return [];
  return SEED_TRANSACTIONS.filter((t) => t.userId === userId);
}

export function getAllUsers(): UnifiedUser[] {
  if (!USE_FIXTURES) return [];
  return SEED_USERS;
}

export function addUser(user: UnifiedUser): void {
  if (USE_FIXTURES) {
    SEED_USERS.push(user);
  }
}

// ─── 6. Snapshots (historical asset snapshots for charts) ───
export const SEED_SNAPSHOTS: UserHistoricalSnapshot[] = []

const lastCaptureByUser: Record<string, number> = {};

export function shouldCaptureSnapshot(userId: string): boolean {
  if (!USE_FIXTURES) return false;
  const now = Date.now();
  const last = lastCaptureByUser[userId] || 0;
  return now - last > 2 * 60 * 60 * 1000; // 2 hours threshold
}

export function captureSnapshot(userId: string, prices: Prices | null): UserHistoricalSnapshot | undefined {
  if (!USE_FIXTURES) return undefined;
  const walletAssets = getWalletForUser(userId);
  const snapshot: UserHistoricalSnapshot = {
    id: `snap-${userId}-${Date.now()}`,
    userId,
    timestamp: new Date().toISOString(),
    totalBalance: walletAssets.reduce((sum, a) => sum + a.value, 0),
    assetBreakdown: walletAssets.map((a) => ({
      ticker: a.ticker,
      quantity: a.quantity,
      price: a.price,
      value: a.value,
    })),
    performance24h: 0,
    performance7d: 0,
    performance30d: 0,
  };
  SEED_SNAPSHOTS.push(snapshot);
  lastCaptureByUser[userId] = Date.now();
  return snapshot;
}

export function getLatestSnapshotForUser(userId: string): UserHistoricalSnapshot | undefined {
  if (!USE_FIXTURES) return undefined;
  return SEED_SNAPSHOTS.filter((s) => s.userId === userId).sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
}

export function getAllSnapshots(): UserHistoricalSnapshot[] {
  if (!USE_FIXTURES) return [];
  return SEED_SNAPSHOTS;
}

// ─── 7. Wallet Rebalancing ───
export function updateWalletQuantity(userId: string, ticker: string, quantity: number): void {
  if (!USE_FIXTURES) return;
  const asset = SEED_WALLET_ASSETS.find(
    (w) => w.userId === userId && w.ticker === ticker
  );
  if (asset) {
    asset.quantity = quantity;
    asset.availableQuantity = quantity;
    asset.value = quantity * asset.price;
  }
}

export function reallocateProportionally(
  userId: string,
  newTotalValue: number,
  prices: Prices | null
): void {
  if (!USE_FIXTURES) return;
  
  const walletAssets = getWalletForUser(userId);
  const pricedAssets = walletAssets
    .map((asset) => {
      // Prices is a Record<string, { usd: number; usd_24h_change?: number }>
      const priceData = prices?.[asset.ticker as keyof typeof prices];
      const livePrice = priceData?.usd || asset.price;
      return { asset, livePrice, value: asset.quantity * livePrice };
    })
    .filter(({ livePrice }) => livePrice > 0);

  const currentTotalValue = pricedAssets.reduce((sum, entry) => sum + entry.value, 0);
  if (currentTotalValue <= 0) return;

  // Update each asset proportionally in the seed data
  SEED_WALLET_ASSETS.forEach((seedAsset) => {
    if (seedAsset.userId !== userId) return;
    
    const pricedEntry = pricedAssets.find((p) => p.asset.ticker === seedAsset.ticker);
    if (!pricedEntry) return;

    const proportion = pricedEntry.value / currentTotalValue;
    const newValue = proportion * newTotalValue;
    const newQuantity = newValue / pricedEntry.livePrice;

    seedAsset.quantity = newQuantity;
    seedAsset.availableQuantity = newQuantity;
    seedAsset.value = newValue;
    seedAsset.price = pricedEntry.livePrice;
  });
}
