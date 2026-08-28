'use client';

import React, { useState, useEffect } from 'react';
import { SendAssetInfo, NetworkOption } from './types';

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
  const [usdValue, setUsdValue] = useState<string>('');

  // Convert balance to number
  const balance = parseFloat(asset.balance?.replace(/,/g, '') || '0');
  
  // Calculate USD value (mock conversion rates)
  const getUsdValue = (assetTicker: string, assetAmount: number): number => {
    const rates: Record<string, number> = {
      'BTC': 67500,
      'ETH': 3450,
      'SOL': 148,
      'BNB': 580,
      'USDT': 1,
      'XRP': 0.62,
      'ADA': 0.48,
      'DOT': 7.25,
      'DOGE': 0.10,
      'LINK': 14.50,
    };
    return (rates[assetTicker] || 1) * assetAmount;
  };

  // Update USD value when amount changes
  useEffect(() => {
    const amt = parseFloat(amount) || 0;
    setUsdValue(getUsdValue(asset.ticker, amt).toFixed(2));
  }, [amount, asset.ticker]);

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
    if (fee === 0) return `~0 ${ticker} (1%)`;
    return `${fee.toFixed(8)} ${ticker} (1%)`;
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
              ≈ ${parseFloat(usdValue).toLocaleString()} USD
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