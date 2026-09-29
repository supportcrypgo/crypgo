'use client';

import React, { useMemo } from 'react';
import { SendAssetInfo, NetworkOption } from './types';
import { useCryptoPricesGlobal } from '@/context/CryptoPriceContext';
import { TICKER_TO_COINGECKO_KEY } from '@/lib/priceMapping';
import type { Prices } from '@/app/dashboard/components/types';

interface AmountFieldProps {
  asset: SendAssetInfo;
  network: NetworkOption;
  amount: string;
  networkFee: number; // Now a number (calculated as amount * feePercentage)
  onAmountChange: (amount: string) => void;
}

export default function AmountField({
  asset,
  network,
  amount,
  networkFee,
  onAmountChange,
}: AmountFieldProps) {
  const { prices, isLoading } = useCryptoPricesGlobal();

  // Convert balance to number
  const balance = parseFloat(asset.balance?.replace(/,/g, '') || '0');

  const usdValue = useMemo<number | null>(() => {
    const assetAmount = Number.parseFloat(amount) || 0;
    const coingeckoKey = TICKER_TO_COINGECKO_KEY[asset.ticker];

    if (!coingeckoKey || !prices) {
      return null;
    }

    const priceEntry = prices[coingeckoKey as keyof Prices];
    const livePrice = Number(priceEntry?.usd ?? 0);

    if (!Number.isFinite(livePrice) || livePrice <= 0) {
      return null;
    }

    return livePrice * assetAmount;
  }, [amount, asset.ticker, prices]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers and one decimal point
    if (/^\d*\.?\d*$/.test(value)) {
      onAmountChange(value);
    }
  };

  const handleMaxClick = () => {
    // With 1% fee, total cost = amount * 1.01
    // So max sendable amount = balance / 1.01
    const maxAmount = balance / 1.01;
    if (maxAmount > 0) {
      onAmountChange(maxAmount.toFixed(8).replace(/\.?0+$/, ''));
    }
  };

  // Format fee for display
  const formatFee = (fee: number, ticker: string): string => {
    if (fee === 0) return `0 ${ticker}`;
    return `${fee.toFixed(8)} ${ticker}`;
  };

  return (
    <div className="space-y-4 animate-in fade-in-50 slide-in-from-left-1 duration-200">
      <label className="text-xs font-medium text-charcoalGray uppercase tracking-wider block">
        Amount
      </label>
      
      <div className="relative">
        <div className="flex items-center">
          <span className="absolute left-4 text-charcoalGray text-lg font-medium">{asset.ticker}</span>
          <input
            type="text"
            value={amount}
            onChange={handleAmountChange}
            placeholder="0.00"
            className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/5 rounded-xl text-right text-xl font-medium text-white placeholder-charcoalGray focus:border-primary/50 transition-colors"
            inputMode="decimal"
          />
        </div>
        
        {amount && (
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-charcoalGray">
              {isLoading
                ? 'Loading live price…'
                : usdValue === null
                  ? 'Live price unavailable'
                  : `≈ $${usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD`}
            </span>
            <button
              type="button"
              onClick={handleMaxClick}
              className="text-primary hover:text-primary/80 font-medium text-sm transition-colors"
            >
              Max
            </button>
          </div>
        )}
      </div>

      {/* Balance Info */}
      <div className="flex items-center justify-between text-sm text-charcoalGray bg-white/5 px-4 py-3 rounded-xl border border-white/5">
        <span>Available balance</span>
        <span className="font-medium text-white">{asset.balance} {asset.ticker}</span>
      </div>

      {/* Network Fee Info */}
      <div className="flex items-center justify-between text-sm text-charcoalGray bg-primary/5 px-4 py-3 rounded-xl border border-primary/10">
        <span>Network fee ({network.shortName || network.name})</span>
        <span className="font-medium text-primary">{formatFee(networkFee, asset.ticker)}</span>
      </div>
    </div>
  );
}