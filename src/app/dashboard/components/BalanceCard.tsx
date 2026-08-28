'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Prices } from './types';
import { UnifiedWalletAsset } from '@/types/unified';
import { adminApi, walletApi } from '@/data/api';
import { PerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import { shouldUseFixtures } from '@/lib/dataSource';

interface BalanceCardProps {
  totalBalance: number;
  prices: Prices | null;
  isLoading: boolean;
  isDesktop?: boolean;
  editable?: boolean;
  userId?: string;
  performanceMetrics?: PerformanceMetrics | null;
  availableBalance?: number;
  maskBalance?: boolean;
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function AnimatedCurrency({ value, isDesktop }: { value: number; isDesktop: boolean }) {
  const prefersReducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(value);
  const frameRef = useRef<number | null>(null);
  const initialRenderRef = useRef(true);

  useEffect(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (initialRenderRef.current || prefersReducedMotion) {
      initialRenderRef.current = false;
      setDisplayValue(value);
      return;
    }

    const startValue = displayValue;
    const endValue = value;
    const duration = 260;
    const startTime = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = easeOutCubic(progress);
      const nextValue = startValue + (endValue - startValue) * eased;
      setDisplayValue(nextValue);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        frameRef.current = null;
        setDisplayValue(endValue);
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [prefersReducedMotion, value]);

  const formatted = formatCurrency(displayValue);
  const [whole, cents] = formatted.split('.');

  return (
    <>
      <span className="tabular-nums">{whole}</span>
      <span className={isDesktop ? 'text-[0.5em] align-baseline ml-[0.05em] tabular-nums' : 'text-[1em] align-baseline ml-0 tabular-nums'}>
        .{cents}
      </span>
    </>
  );
}

export default function BalanceCard({ totalBalance, prices, isLoading, isDesktop = false, editable = false, userId, performanceMetrics, availableBalance, maskBalance = false }: BalanceCardProps) {
  const getLivePrice = (ticker: string) => {
    const keyMap: Record<string, keyof Prices> = {
      BTC: 'bitcoin',
      ETH: 'ethereum',
      SOL: 'solana',
      LTC: 'litecoin',
      BNB: 'binancecoin',
      DOGE: 'dogecoin',
      ADA: 'cardano',
      DOT: 'polkadot',
      LINK: 'chainlink',
    };

    const key = keyMap[ticker.toUpperCase()];
    return key ? Number(prices?.[key]?.usd ?? 0) : 0;
  };

  const perf = performanceMetrics
    ? {
        today: performanceMetrics.performance24h ?? 0,
        days7: performanceMetrics.performance7d ?? 0,
        days30: performanceMetrics.performance30d ?? 0,
      }
    : null;
  const balanceStr = isLoading || maskBalance ? '$0.00' : formatCurrency(totalBalance);
  const [balanceWhole, balanceCents] = balanceStr.split('.');
  const balanceDigits = isLoading || maskBalance ? (
    <>
      <span>{balanceWhole}</span>
      <span className={isDesktop ? 'text-[0.5em] align-baseline ml-[0.05em] tabular-nums' : 'text-[1em] align-baseline ml-0 tabular-nums'}>
        .{balanceCents}
      </span>
    </>
  ) : (
    <AnimatedCurrency value={totalBalance} isDesktop={isDesktop} />
  );

  const handleBalanceClick = async () => {
    if (!editable || !prices || !userId) return;
    const newTotal = prompt('Enter new total balance value (in USD):', String(totalBalance));
    if (newTotal === null) return; // cancelled
    const parsed = parseFloat(newTotal.replace(/[$,]/g, ''));
    if (isNaN(parsed) || parsed <= 0) return;

    try {
      const assets: UnifiedWalletAsset[] = userId
        ? await adminApi.getUserWallet(userId)
        : await walletApi.getMyWallet();

      const pricedAssets = assets
        .map((asset) => {
          const livePrice = getLivePrice(asset.ticker) || asset.price;
          return { asset, livePrice, value: asset.quantity * livePrice };
        })
        .filter(({ livePrice }) => livePrice > 0);

      const totalValue = pricedAssets.reduce((sum, entry) => sum + entry.value, 0);
      if (totalValue <= 0) return;

      await Promise.all(
        pricedAssets.map(({ asset, livePrice, value }) => {
          const proportion = value / totalValue;
          const newValue = proportion * parsed;
          const newQuantity = newValue / livePrice;

          return userId
            ? adminApi.updateUserAssetByTicker(userId, asset.ticker, {
                quantity: newQuantity,
                available_quantity: newQuantity,
              })
            : walletApi.updateAsset(asset.ticker, {
                quantity: newQuantity,
                available_quantity: newQuantity,
              } as any);
        })
      );

      window.location.reload();
    } catch (error) {
      if (shouldUseFixtures()) {
        const { reallocateProportionally, getWalletForUser } = await import('@/data/store');
        reallocateProportionally(userId, parsed, prices);
        const updatedAssets = getWalletForUser(userId);

        try {
          if (userId) {
            await Promise.all(
              updatedAssets.map((asset) =>
                adminApi.updateUserAssetByTicker(userId, asset.ticker, {
                  quantity: asset.quantity,
                  available_quantity: asset.availableQuantity,
                })
              )
            );
          } else {
            await Promise.all(
              updatedAssets.map((asset) =>
                walletApi.updateAsset(asset.ticker, {
                  quantity: asset.quantity,
                  available_quantity: asset.availableQuantity,
                } as any)
              )
            );
          }
          window.location.reload();
        } catch (fallbackError) {
          console.error('Failed to persist reallocation, using in-memory fallback:', fallbackError);
        }
      } else {
        console.error('Failed to persist reallocation:', error);
      }
    }
  };

  const balanceLabel = (
    <p className="text-xs font-medium text-charcoalGray uppercase tracking-wider lg:text-sm lg:font-semibold">
      Total Balance
    </p>
  );

  const mobilePerformance = perf && (
    <div className="mt-2 flex items-center justify-center gap-2 text-xs">
      <span className="text-charcoalGray">30D</span>
      <span className={`font-semibold ${perf.days30 >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {perf.days30 >= 0 ? '+' : ''}{perf.days30.toFixed(2)}%
      </span>
    </div>
  );

  const balanceContent = (
    <>
      {balanceLabel}
      <h2
        className={`${
          isDesktop ? 'mt-1.5 text-[4.5rem] leading-none tracking-tight' : 'text-[32px] mt-2 leading-none'
        } font-bold text-white tabular-nums`}
        aria-label={balanceStr}
      >
        {balanceDigits}
      </h2>
      {/* Available balance */}
      {availableBalance !== undefined && !isLoading && !maskBalance && (
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
          {availableBalance !== undefined && (
            <div className="flex items-center gap-1.5 text-green-400">
              <span className="font-medium">Available:</span>
              <span className="font-mono tabular-nums">${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>
      )}
    </>
  );

  const wrapperClass = editable ? 'cursor-pointer group' : '';

  if (isDesktop) {
    return (
      <div className={`w-full ${wrapperClass}`} onClick={handleBalanceClick}>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 max-w-full">
            {balanceContent}
          </div>
          <div className="grid grid-cols-2 gap-3 w-full xl:w-auto xl:flex xl:items-center xl:gap-6 xl:pt-2 xl:shrink-0">
            {perf && (
              <>
                <div className="min-w-0 text-center rounded-lg border border-charcoalGray/20 px-3 py-2 xl:rounded-none xl:border-0 xl:border-r xl:border-charcoalGray/30 xl:px-4 xl:py-0">
                  <p className="text-xs text-charcoalGray mb-1">7 Days</p>
                  <p className={`text-sm font-semibold ${perf.days7 >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {perf.days7 >= 0 ? '+' : ''}{perf.days7.toFixed(2)}%
                  </p>
                </div>
                <div className="min-w-0 text-center rounded-lg border border-charcoalGray/20 px-3 py-2 xl:rounded-none xl:border-0 xl:px-4 xl:py-0">
                  <p className="text-xs text-charcoalGray mb-1">30 Days</p>
                  <p className={`text-sm font-semibold ${perf.days30 >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {perf.days30 >= 0 ? '+' : ''}{perf.days30.toFixed(2)}%
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${wrapperClass}`} onClick={handleBalanceClick}>
      <div className="flex flex-col items-center text-center">
        {balanceLabel}
        <h2 className="mt-2 text-[32px] font-bold leading-none text-white tabular-nums" aria-label={balanceStr}>
          {balanceDigits}
        </h2>
        {mobilePerformance}
      </div>
    </div>
  );
}
