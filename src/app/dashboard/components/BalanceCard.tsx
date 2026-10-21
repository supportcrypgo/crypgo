'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ArrowLeft, ChevronDown, Search } from 'lucide-react';
import { Prices } from './types';
import { UnifiedWalletAsset } from '@/types/unified';
import { adminApi, walletApi } from '@/data/api';
import { PerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import { shouldUseFixtures } from '@/lib/dataSource';
import { useDisplayCurrency } from '@/context/DisplayCurrencyContext';
import CurrencyLoadingShimmer from './CurrencyLoadingShimmer';

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
  walletError?: string | null;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function AnimatedCurrency({
  value,
  formatFromUsd,
}: {
  value: number;
  formatFromUsd: (amount: number) => string;
}) {
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

  return <span className="tabular-nums">{formatFromUsd(displayValue)}</span>;
}

export default function BalanceCard({ totalBalance, prices, isLoading, isDesktop = false, editable = false, userId, performanceMetrics, availableBalance, maskBalance = false, walletError = null }: BalanceCardProps) {
  const { currency, rates, formatFromUsd, convertFromUsd, setCurrency, currencySaveError } = useDisplayCurrency();
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [savingCurrency, setSavingCurrency] = useState(false);
  const currencySearchRef = useRef<HTMLInputElement>(null);
  const currencyNames = React.useMemo(
    () => new Intl.DisplayNames(['en'], { type: 'currency' }),
    [],
  );
  const currencyOptions = React.useMemo(
    () => Object.keys(rates).sort((left, right) =>
      left === 'USD' ? -1 : right === 'USD' ? 1 : left.localeCompare(right),
    ),
    [rates],
  );
  const filteredCurrencyOptions = currencyOptions.filter((code) => {
    const query = currencySearch.trim().toLowerCase();
    return !query ||
      code.toLowerCase().includes(query) ||
      (currencyNames.of(code) ?? '').toLowerCase().includes(query);
  });

  useEffect(() => {
    if (!currencyPickerOpen) return;
    currencySearchRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCurrencyPickerOpen(false);
        setCurrencySearch('');
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [currencyPickerOpen]);
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
        today: performanceMetrics.performance24h ?? null,
        days7: performanceMetrics.performance7d ?? null,
        days30: performanceMetrics.performance30d ?? null,
      }
    : null;
  const balanceValueAvailable = convertFromUsd(maskBalance ? 0 : totalBalance) !== null;
  const balanceStr = maskBalance ? formatFromUsd(0) : formatFromUsd(totalBalance);
  const balanceDigits = !balanceValueAvailable ? (
    <CurrencyLoadingShimmer className={isDesktop ? 'h-[0.9em] w-64' : 'h-[0.9em] w-48'} />
  ) : maskBalance ? (
    <span className="tabular-nums">{balanceStr}</span>
  ) : (
    <AnimatedCurrency value={totalBalance} formatFromUsd={formatFromUsd} />
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

  const balanceLabel = isDesktop ? (
    <div className="flex items-center justify-between gap-6">
      <p className="text-xs font-medium text-charcoalGray uppercase tracking-wider lg:text-sm lg:font-semibold">
        Total Balance
      </p>
      <button
        type="button"
        aria-expanded={currencyPickerOpen}
        onClick={() => {
          setCurrencyPickerOpen(true);
          setCurrencySearch('');
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-sm font-medium text-white transition-colors hover:border-primary/50 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span>{currency}</span>
        <ChevronDown className="h-4 w-4 text-charcoalGray" aria-hidden="true" />
      </button>
    </div>
  ) : (
    <p className="text-xs font-medium text-charcoalGray uppercase tracking-wider lg:text-sm lg:font-semibold">
      Total Balance
    </p>
  );

  const mobilePerformance = perf && (
    <div className="mt-2 flex items-center justify-center gap-2 text-xs">
      <span className="text-charcoalGray">24H</span>
      <span className={`font-semibold ${((perf.today ?? 0) >= 0 ? 'text-green-400' : 'text-red-400')}`}>
        {(perf.today ?? 0) >= 0 ? '+' : ''}{(perf.today ?? 0).toFixed(2)}%
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
        aria-label={balanceValueAvailable ? balanceStr : 'Loading total balance'}
      >
        {balanceDigits}
      </h2>
      {/* Available balance */}
      {availableBalance !== undefined && !isLoading && !maskBalance && (
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
          {availableBalance !== undefined && (
            <div className="flex items-center gap-1.5 text-green-400">
              <span className="font-medium">Available:</span>
              <span className="font-mono tabular-nums">
                {convertFromUsd(availableBalance) === null
                  ? <CurrencyLoadingShimmer className="h-3 w-20" />
                  : formatFromUsd(availableBalance)}
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );

  const wrapperClass = editable ? 'cursor-pointer group' : '';

  if (isDesktop) {
    return (
      <div
        className={`relative w-full ${currencyPickerOpen ? 'min-h-[420px] xl:min-h-[280px]' : ''} ${wrapperClass}`}
        onClick={handleBalanceClick}
      >
        {currencyPickerOpen ? (
          <section
            aria-label="Choose display currency"
            className="absolute inset-0 z-20 flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-darkmode p-5 shadow-2xl shadow-black/30 animate-in fade-in-0 zoom-in-[0.98] duration-200 xl:min-h-[280px] xl:p-6"
          >
            <header className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Back to balance"
                onClick={() => {
                  setCurrencyPickerOpen(false);
                  setCurrencySearch('');
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-charcoalGray transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-white">Display currency</h2>
                <p className="text-xs text-charcoalGray">Choose how values appear across your dashboard.</p>
              </div>
              <span className="ml-auto shrink-0 text-sm font-medium text-primary">{currency}</span>
            </header>
            {currencySaveError && (
              <p className="mt-2 text-xs text-red-400" role="alert">{currencySaveError}</p>
            )}

            <label className="relative mt-4 block shrink-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoalGray" aria-hidden="true" />
              <input
                ref={currencySearchRef}
                type="search"
                value={currencySearch}
                onChange={(event) => setCurrencySearch(event.target.value)}
                placeholder="Search currency or code"
                aria-label="Search currencies"
                className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.035] pl-9 pr-3 text-sm text-white outline-none placeholder:text-charcoalGray focus:border-primary/60"
              />
            </label>

            <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.16)_transparent]">
              {filteredCurrencyOptions.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                  {filteredCurrencyOptions.map((code) => (
                    <button
                      key={code}
                      type="button"
                      aria-pressed={code === currency}
                      disabled={savingCurrency}
                      onClick={async () => {
                        setSavingCurrency(true);
                        try {
                          if (await setCurrency(code)) {
                            setCurrencyPickerOpen(false);
                            setCurrencySearch('');
                          }
                        } finally {
                          setSavingCurrency(false);
                        }
                      }}
                      className={`flex min-h-12 items-center justify-between gap-3 rounded-lg px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        code === currency
                          ? 'bg-primary/10 text-white ring-1 ring-primary/40'
                          : 'text-charcoalGray hover:bg-white/[0.05] hover:text-white'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{code}</span>
                        <span className="block truncate text-xs opacity-70">{currencyNames.of(code) ?? code}</span>
                      </span>
                      {code === currency && <span className="text-xs text-primary">Selected</span>}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-charcoalGray">No currencies match that search.</p>
              )}
            </div>
          </section>
        ) : (
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 max-w-full">
              {balanceContent}
            </div>
            <div className="grid grid-cols-2 gap-3 w-full xl:w-auto xl:flex xl:items-center xl:gap-6 xl:pt-2 xl:shrink-0">
              {perf && (
                <>
                  <div className="min-w-0 text-center rounded-lg border border-charcoalGray/20 px-3 py-2 xl:rounded-none xl:border-0 xl:border-r xl:border-charcoalGray/30 xl:px-4 xl:py-0">
                    <p className="text-xs text-charcoalGray mb-1">7 Days</p>
                    <p className={`text-sm font-semibold ${((perf.days7 ?? 0) >= 0 ? 'text-green-400' : 'text-red-400')}`}>
                      {(perf.days7 ?? 0) >= 0 ? '+' : ''}{(perf.days7 ?? 0).toFixed(2)}%
                    </p>
                  </div>
                  <div className="min-w-0 text-center rounded-lg border border-charcoalGray/20 px-3 py-2 xl:rounded-none xl:border-0 xl:px-4 xl:py-0">
                    <p className="text-xs text-charcoalGray mb-1">30 Days</p>
                    <p className={`text-sm font-semibold ${((perf.days30 ?? 0) >= 0 ? 'text-green-400' : 'text-red-400')}`}>
                      {(perf.days30 ?? 0) >= 0 ? '+' : ''}{(perf.days30 ?? 0).toFixed(2)}%
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
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
