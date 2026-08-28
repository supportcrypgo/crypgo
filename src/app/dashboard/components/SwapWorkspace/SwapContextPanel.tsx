'use client';

import React, { useMemo } from 'react';
import QuickActionsCard from '@/app/dashboard/components/QuickActionsCard';
import MarketOverviewCard from '@/app/dashboard/components/MarketOverviewCard';
import Watchlist from '@/app/dashboard/components/Watchlist';
import PortfolioAllocationCard from '@/app/dashboard/components/PortfolioAllocationCard';
import LatestNewsCard from '@/app/dashboard/components/LatestNewsCard';
import { Asset, ASSET_CONFIG } from '@/app/dashboard/components/types';
import { useUnified } from '@/context/UnifiedContext';

interface SwapContextPanelProps {
  isMobile?: boolean;
}

export function SwapContextPanel({ isMobile = false }: SwapContextPanelProps) {
  const { walletAssets } = useUnified();
  const liveAssets = useMemo<Asset[]>(
    () =>
      walletAssets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        ticker: asset.ticker,
        logo: asset.logo,
        quantity: asset.quantity,
        availableQuantity: asset.availableQuantity,
        price: asset.price,
        value: asset.value,
        change24h: asset.change24h,
        percentage: asset.percentage,
      })),
    [walletAssets]
  );

  if (isMobile) {
    return (
      <div className="space-y-4">
        <QuickActionsCard />
        <MarketOverviewCard />
        <Watchlist assets={liveAssets} isLoading={liveAssets.length === 0} />
        <PortfolioAllocationCard assets={liveAssets} />
        <LatestNewsCard />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <QuickActionsCard />
      <MarketOverviewCard />
      <Watchlist assets={liveAssets} isLoading={liveAssets.length === 0} />
      <PortfolioAllocationCard assets={liveAssets} />
      <LatestNewsCard />
    </div>
  );
}
