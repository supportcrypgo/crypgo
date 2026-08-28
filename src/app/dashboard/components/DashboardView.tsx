'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useCryptoPricesGlobal } from '@/context/CryptoPriceContext';
import { useUnified } from '@/context/UnifiedContext';
import { useSnapshotCapture } from '@/hooks/useSnapshotCapture';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import { Asset, ASSET_CONFIG } from './types';
import { adminApi } from '@/data/api';
import { aggregateWalletAmountsByTicker, enrichWalletAssetsWithLivePrices, deriveWalletSummary } from '@/lib/walletBalances';
import type { UnifiedWalletAsset } from '@/types/unified';

import MobileHeader from './MobileHeader';
import DesktopSidebar, { SIDEBAR_OFFSET_CLASS } from './DesktopSidebar';
import DesktopHeader from './DesktopHeader';
import BalanceCard from './BalanceCard';
import QuickActionsCard from './QuickActionsCard';
import Watchlist from './Watchlist';
import RecentActivityCard from './RecentActivityCard';
import MarketOverviewCard from './MarketOverviewCard';
import SecurityStatusCard from './SecurityStatusCard';
import LatestNewsCard from './LatestNewsCard';
import BottomNav from './BottomNav';
import CautionModalGate from '@/components/Auth/CautionModalGate';

interface DashboardViewProps {
  userId?: string;
  targetUser?: import('@/types/unified').UnifiedUser | null;
}

export default function DashboardView({ userId }: DashboardViewProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { walletAssets: unifiedWalletAssets, walletSummary: unifiedWalletSummary, isLoading: unifiedLoading } = useUnified();
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminRawWalletAssets, setAdminRawWalletAssets] = useState<UnifiedWalletAsset[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [cautionModalOpen, setCautionModalOpen] = useState(false);

  const { prices, isLoading: pricesLoading, error: pricesError } = useCryptoPricesGlobal();
  const [walletError, setWalletError] = useState<string | null>(null);

  const fetchWalletData = useCallback(async () => {
    if (!userId) return;
    try {
      setWalletLoading(true);
      setWalletError(null);
      const assets = await adminApi.getUserWallet(userId);
      setAdminRawWalletAssets(assets as UnifiedWalletAsset[]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load wallet data';
      setWalletError(errorMessage);
      setAdminRawWalletAssets([]);
    } finally {
      setWalletLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchWalletData();
  }, [fetchWalletData, userId]);

  const adminWalletAssets = useMemo(
    () => (userId ? enrichWalletAssetsWithLivePrices(adminRawWalletAssets, prices) : []),
    [adminRawWalletAssets, prices, userId]
  );

  const adminWalletSummary = useMemo(
    () => deriveWalletSummary(adminWalletAssets),
    [adminWalletAssets]
  );

  const currentWalletAssets = userId ? adminWalletAssets : unifiedWalletAssets;
  const currentWalletSummary = userId ? adminWalletSummary : unifiedWalletSummary;
  const walletDataLoaded = userId ? !walletLoading : !unifiedLoading;
  const userAssetMap = useMemo(
    () => (walletDataLoaded ? aggregateWalletAmountsByTicker(currentWalletAssets, 'quantity') : {}),
    [currentWalletAssets, walletDataLoaded]
  );

  const assets = useMemo(() => {
    if (!prices) {
      return ASSET_CONFIG.map((config) => ({
        ...config,
        price: 0,
        value: 0,
        change24h: 0,
        percentage: 0,
      }));
    }

    const assetsWithPrices: Asset[] = ASSET_CONFIG.map((config) => {
      const priceData = prices[config.id as keyof typeof prices];
      const price = priceData?.usd || 0;
      const change24h = priceData?.usd_24h_change || 0;
      const quantity = walletDataLoaded ? (userAssetMap[config.ticker] ?? 0) : config.quantity;
      const value = quantity * price;
      return {
        ...config,
        quantity,
        price,
        value,
        change24h,
        percentage: 0,
      };
    });

    const totalVal = assetsWithPrices.reduce((sum, a) => sum + a.value, 0);
    const assetsWithPercentages = assetsWithPrices.map((a) => ({
      ...a,
      percentage: totalVal > 0 ? (a.value / totalVal) * 100 : 0,
    }));

    return assetsWithPercentages;
  }, [prices, userAssetMap, walletDataLoaded]);

  const watchlistAssets = useMemo(() => assets, [assets]);
  const isLoading = pricesLoading || walletLoading || unifiedLoading;
  const displayedTotalBalance = currentWalletSummary.totalBalance;

  const { allSnapshots } = useSnapshotCapture(userId, prices);
  const performanceMetrics = usePerformanceMetrics(allSnapshots, displayedTotalBalance);

  if (!isDesktop) {
    return (
      <div className="min-h-screen bg-darkmode text-white">
        <MobileHeader onMenuClick={() => setMenuOpen(!menuOpen)} showMenuButton={false} />
        <CautionModalGate userId={userId} onOpenChange={setCautionModalOpen} />

        {menuOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-30 lg:hidden"
            onClick={() => setMenuOpen(false)}
          />
        )}

        <main className="px-5 pt-4 pb-[88px] space-y-5">
          {pricesError && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-400">{pricesError}</p>
            </div>
          )}

          <BalanceCard
            totalBalance={displayedTotalBalance}
            prices={prices}
            isLoading={isLoading}
            editable={false}
            userId={userId}
            performanceMetrics={performanceMetrics}
            availableBalance={currentWalletSummary.availableBalance}
            maskBalance={cautionModalOpen}
          />

          <section className="space-y-3">
            <QuickActionsCard />
          </section>

          <Watchlist assets={watchlistAssets} isLoading={isLoading} />
          <LatestNewsCard />
        </main>

        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-darkmode text-white">
      <DesktopSidebar />
      <CautionModalGate userId={userId} onOpenChange={setCautionModalOpen} />

      <div className={SIDEBAR_OFFSET_CLASS}>
        <DesktopHeader title="Dashboard" />

        <main className="px-6 pt-6 pb-10 space-y-5">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_460px] gap-5">
            <div className="space-y-5">
              {pricesError && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                  <p className="text-xs text-amber-400">{pricesError}</p>
                </div>
              )}

              <BalanceCard
                totalBalance={displayedTotalBalance}
                prices={prices}
                isLoading={isLoading}
                isDesktop
                editable={false}
                userId={userId}
                performanceMetrics={performanceMetrics}
                availableBalance={currentWalletSummary.availableBalance}
                maskBalance={cautionModalOpen}
              />

              <Watchlist assets={watchlistAssets} isLoading={isLoading} />
              <LatestNewsCard />
            </div>

            <aside className="space-y-5">
              <RecentActivityCard />
              <MarketOverviewCard />
              <SecurityStatusCard />
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
