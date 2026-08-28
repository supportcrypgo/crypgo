'use client';

import React, { createContext, useContext, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  UnifiedUser,
  UnifiedWalletAsset,
  UnifiedWalletSummary,
  UnifiedTransaction,
} from '@/types/unified';
import {
  getUserById,
  getWalletForUser,
  getTransactionsForUser,
  getAllUsers,
  addUser,
} from '@/data/store';
import { shouldUseFixtures } from '@/lib/dataSource';
import { 
  profileApi, 
  walletApi, 
  adminApi,
} from '@/data/api';
import { useCryptoPricesGlobal } from './CryptoPriceContext';
import { TICKER_TO_COINGECKO_KEY } from '@/lib/priceMapping';
import type { Prices } from '@/app/dashboard/components/types';
import {
  enrichWalletAssetsWithLivePrices,
  deriveWalletSummary,
  aggregateWalletAmountsByTicker
} from '@/lib/walletBalances';

// ---------- helper: compute summary metrics from transactions ----------
function deriveTxMetrics(txs: UnifiedTransaction[]) {
  const totalVolume = txs.reduce((s, t) => s + t.totalValue, 0);
  const completed = txs.filter((t) => t.status === 'completed').length;
  return {
    totalVolume: Math.round(totalVolume * 100) / 100,
    totalTransactions: txs.length,
    completionRate: txs.length > 0 ? Math.round((completed / txs.length) * 100) : 0,
  };
}

// ---------- context shape ----------
export interface UnifiedContextValue {
  user: UnifiedUser | null;
  userId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Wallet
  walletAssets: UnifiedWalletAsset[];
  walletSummary: UnifiedWalletSummary;

  // Transactions
  transactions: UnifiedTransaction[];
  txMetrics: ReturnType<typeof deriveTxMetrics>;

  // Admin / All Profiles
  profiles: UnifiedUser[];

  // Generic helpers
  getUser: (id: string) => UnifiedUser | undefined;

  // Admin
  addProfile: (user: UnifiedUser) => void;

  // API actions
  refreshProfile: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  refreshAll: () => Promise<void>;

  // ─── Transaction Execution ───
  executeSendTransaction: (data: {
    asset: string;
    amount: number;
    to_address: string;
    network?: string;
    memo?: string;
  }) => Promise<any>;
  executeReceiveTransaction: (data: {
    asset: string;
  }) => Promise<any>;
  executeSwapTransaction: (data: {
    from_asset: string;
    to_asset: string;
    amount: number;
  }) => Promise<any>;
  executeInternalTransfer: (data: {
    recipient: string;
    asset: string;
    amount: number;
    memo?: string;
  }) => Promise<any>;

  // ─── Profile ───
  updateUserProfile: (data: Partial<UnifiedUser>) => Promise<any>;
  uploadProfilePhoto: (file: File) => Promise<string>;
  updateUserVerificationStatus: (status: string) => Promise<void>;
}

const UnifiedContext = createContext<UnifiedContextValue | null>(null);

export function UnifiedProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading, isAuthenticated, userId } = useAuth();
  const { prices } = useCryptoPricesGlobal();

  const [walletAssets, setWalletAssets] = useState<UnifiedWalletAsset[]>([]);
  const [walletSummary, setWalletSummary] = useState<UnifiedWalletSummary>({
    totalBalance: 0,
    availableBalance: 0,
    lockedBalance: 0,
    change24h: 0,
    change24hPercentage: 0,
  });
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [profiles, setProfiles] = useState<UnifiedUser[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const walletAssetsRef = useRef<UnifiedWalletAsset[]>([]);

  useEffect(() => {
    walletAssetsRef.current = walletAssets;
  }, [walletAssets]);

  // Refresh strategies
  const refreshProfile = async () => {
    if (!isAuthenticated || !userId) return;
    try {
      const userData = await profileApi.getMe();
      setProfiles(prev =>
        prev.map(p => p.id === (userData as any).id ? userData as any : p)
      );
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    }
  };

  const refreshWallet = async () => {
    if (!isAuthenticated) return;
    try {
      const apiAssets = await walletApi.getMyWallet();
      const seedAssets = apiAssets as UnifiedWalletAsset[];
      const enrichedAssets = enrichWalletAssetsWithLivePrices(seedAssets, prices);
      const summary = deriveWalletSummary(enrichedAssets);
      setWalletAssets(enrichedAssets);
      setWalletSummary(summary);
    } catch (error) {
      console.error('Failed to refresh wallet:', error);
      if (shouldUseFixtures() && userId) {
        const seedWallet = getWalletForUser(userId);
        const enrichedAssets = enrichWalletAssetsWithLivePrices(seedWallet, prices);
        setWalletAssets(enrichedAssets);
        setWalletSummary(deriveWalletSummary(enrichedAssets));
      } else {
        setWalletAssets([]);
        setWalletSummary({
          totalBalance: 0,
          availableBalance: 0,
          lockedBalance: 0,
          change24h: 0,
          change24hPercentage: 0,
        });
      }
    }
  };

  const refreshAll = async () => {
    try {
      if (isAuthenticated && userId) {
        const [apiWallet, apiTransactions] = await Promise.all([
          walletApi.getMyWallet(),
          walletApi.getTransactions(),
        ]);
        const wallet = apiWallet as UnifiedWalletAsset[];
        const enrichedWallet = enrichWalletAssetsWithLivePrices(wallet, prices);
        setWalletAssets(enrichedWallet);
        setWalletSummary(deriveWalletSummary(enrichedWallet));
        setTransactions(apiTransactions);
      }
    } catch (error) {
      console.error('Failed to refresh all data:', error);
      if (shouldUseFixtures() && isAuthenticated && userId) {
        const seedWalletAssets = getWalletForUser(userId);
        const enrichedAssets = enrichWalletAssetsWithLivePrices(seedWalletAssets, prices);
        setWalletAssets(enrichedAssets);
        setWalletSummary(deriveWalletSummary(enrichedAssets));
        setTransactions(getTransactionsForUser(userId));
      }
    }
  };

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      if (authLoading) return;

      setIsLoadingData(true);
      try {
        // Fetch profiles only for authenticated admin users.
        if (isAuthenticated && user?.role === 'admin') {
          try {
            const apiProfiles = await adminApi.getUsers();
            setProfiles(apiProfiles);
          } catch {
            setProfiles(shouldUseFixtures() ? getAllUsers() : []);
          }
        } else {
          setProfiles(shouldUseFixtures() ? getAllUsers() : []);
        }

        // If authenticated user, fetch their data
        if (isAuthenticated && userId) {
          const [walletResult, transactionsResult] = await Promise.allSettled([
            walletApi.getMyWallet(),
            walletApi.getTransactions(),
          ]);

          if (walletResult.status === 'fulfilled') {
            const seedWalletAssets = walletResult.value as UnifiedWalletAsset[];
            const enrichedAssets = enrichWalletAssetsWithLivePrices(seedWalletAssets, prices);
            setWalletAssets(enrichedAssets);
            setWalletSummary(deriveWalletSummary(enrichedAssets));
          } else if (shouldUseFixtures()) {
            const seedWalletAssets = getWalletForUser(userId);
            const enrichedAssets = enrichWalletAssetsWithLivePrices(seedWalletAssets, prices);
            setWalletAssets(enrichedAssets);
            setWalletSummary(deriveWalletSummary(enrichedAssets));
          } else {
            setWalletAssets([]);
            setWalletSummary({
              totalBalance: 0,
              availableBalance: 0,
              lockedBalance: 0,
              change24h: 0,
              change24hPercentage: 0,
            });
          }

          setTransactions(
            transactionsResult.status === 'fulfilled'
              ? transactionsResult.value
              : shouldUseFixtures()
                ? getTransactionsForUser(userId)
                : []
          );
        }
      } catch (error) {
        console.error('Initial data fetch failed:', error);
        if (isAuthenticated && userId) {
          if (shouldUseFixtures()) {
            const seedWalletAssets = getWalletForUser(userId);
            const enrichedAssets = enrichWalletAssetsWithLivePrices(seedWalletAssets, prices);
            const summary = deriveWalletSummary(enrichedAssets);
            setWalletAssets(enrichedAssets);
            setWalletSummary(summary);
            setTransactions(getTransactionsForUser(userId));
          } else {
            setWalletAssets([]);
            setWalletSummary({
              totalBalance: 0,
              availableBalance: 0,
              lockedBalance: 0,
              change24h: 0,
              change24hPercentage: 0,
            });
            setTransactions([]);
          }
        }
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, [authLoading, isAuthenticated, userId]);

  // Initial authenticated bootstraps are handled by fetchData() above.
  // Avoid firing another full wallet/transactions refresh immediately after login,
  // because it creates a response burst that can trigger backend throttling.

  useEffect(() => {
    if (!prices || !isAuthenticated || !userId || walletAssetsRef.current.length === 0) return;

    const enrichedAssets = enrichWalletAssetsWithLivePrices(walletAssetsRef.current, prices);
    setWalletAssets(enrichedAssets);
    setWalletSummary(deriveWalletSummary(enrichedAssets));
  }, [prices, isAuthenticated, userId]);

  // ─── Transaction Execution ───
  const executeSendTransaction = useCallback(async (data: {
    asset: string;
    amount: number;
    to_address: string;
    network?: string;
    memo?: string;
  }) => {
    const result = await walletApi.withdraw({
      asset: data.asset,
      amount: data.amount,
      to_address: data.to_address,
      network: data.network,
      memo: data.memo,
    });
    await refreshWallet();
    return result;
  }, [refreshWallet]);

  const executeReceiveTransaction = useCallback(async (data: { asset: string }) => {
    const result = await walletApi.getDepositAddress(data.asset);
    await refreshWallet();
    return result;
  }, [refreshWallet]);

  const executeSwapTransaction = useCallback(async (data: {
    from_asset: string;
    to_asset: string;
    amount: number;
  }) => {
    const result = await walletApi.swap(data);
    await refreshWallet();
    return result;
  }, [refreshWallet]);

  const executeInternalTransfer = useCallback(async (data: {
    recipient: string;
    asset: string;
    amount: number;
    memo?: string;
  }) => {
    const result = await walletApi.transfer(data);
    await refreshWallet();
    return result;
  }, [refreshWallet]);

  // ─── Profile ───
  const updateUserProfile = useCallback(async (data: Partial<UnifiedUser>) => {
    const result = await profileApi.updateMe(data as any);
    await refreshProfile();
    return result;
  }, [refreshProfile]);

  const uploadProfilePhoto = useCallback(async (file: File) => {
    const result = await profileApi.uploadAvatar(file);
    await refreshProfile();
    return (result as any).avatar_url || '';
  }, [refreshProfile]);

  const updateUserVerificationStatus = useCallback(async (status: string) => {
    console.warn('updateUserVerificationStatus: Not yet implemented in backend');
  }, []);

  const enrichedAssets = enrichWalletAssetsWithLivePrices(walletAssets, prices);

  const value = useMemo<UnifiedContextValue>(() => {
    return {
      user,
      userId: userId ?? '',
      isAuthenticated,
      isLoading: authLoading || isLoadingData,

      walletAssets: enrichedAssets,
      walletSummary,

      transactions,
      txMetrics: deriveTxMetrics(transactions),

      profiles,

      getUser: (id: string) => (shouldUseFixtures() ? getUserById(id) : undefined),

      addProfile: addUser,

      refreshProfile,
      refreshWallet,
      refreshAll,

      // Transaction Execution
      executeSendTransaction,
      executeReceiveTransaction,
      executeSwapTransaction,
      executeInternalTransfer,

      // Profile
      updateUserProfile,
      uploadProfilePhoto,
      updateUserVerificationStatus,
    };
  }, [
    user,
    userId,
    isAuthenticated,
    authLoading,
    isLoadingData,
    enrichedAssets,
    walletSummary,
    transactions,
    profiles,
    executeSendTransaction,
    executeReceiveTransaction,
    executeSwapTransaction,
    executeInternalTransfer,
    updateUserProfile,
    uploadProfilePhoto,
    updateUserVerificationStatus,
  ]);

  return (
    <UnifiedContext.Provider value={value}>
      {children}
    </UnifiedContext.Provider>
  );
}

export function useUnified(): UnifiedContextValue {
  const ctx = useContext(UnifiedContext);
  if (!ctx) {
    return {
      user: null,
      userId: '',
      isAuthenticated: false,
      isLoading: false,
      walletAssets: [],
      walletSummary: {
        totalBalance: 0,
        availableBalance: 0,
        lockedBalance: 0,
        change24h: 0,
        change24hPercentage: 0,
      },
      transactions: [],
      txMetrics: { totalVolume: 0, totalTransactions: 0, completionRate: 0 },
      profiles: [],
      getUser: () => undefined,
      addProfile: () => undefined,
      refreshProfile: async () => undefined,
      refreshWallet: async () => undefined,
      refreshAll: async () => undefined,

      executeSendTransaction: async () => undefined,
      executeReceiveTransaction: async () => undefined,
      executeSwapTransaction: async () => undefined,
      executeInternalTransfer: async () => undefined,

      updateUserProfile: async () => undefined,
      uploadProfilePhoto: async () => '',
      updateUserVerificationStatus: async () => undefined,
    };
  }
  return ctx;
}