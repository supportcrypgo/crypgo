'use client';

import React, { useState } from 'react';
import { Loader2, Maximize2 } from 'lucide-react';
import AssetSelector from '../shared/AssetSelector';
import type { SwapAsset } from '../shared/types';

interface PayAssetInputProps {
  payAsset: SwapAsset | null;
  receiveAsset: SwapAsset | null;
  assets: SwapAsset[];
  payAmount: string;
  isCalculating: boolean;
  isSwapping: boolean;
  onPayAssetChange: (asset: SwapAsset | null) => void;
  onPayAmountChange: (amount: string) => void;
  onMaxClick: () => void;
}

export function PayAssetInput({
  payAsset,
  receiveAsset,
  assets,
  payAmount,
  isCalculating,
  isSwapping,
  onPayAssetChange,
  onPayAmountChange,
  onMaxClick,
}: PayAssetInputProps) {

  const handlePayAmountChange = (value: string) => {
    const sanitized = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    onPayAmountChange(sanitized);
  };

  return (
    <div className="space-y-4">
      {/* Header with label and balance */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-charcoalGray uppercase tracking-wide">You Pay</span>
        {payAsset && (
          <span className="text-xs text-charcoalGray">
            Available: {payAsset.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })} {payAsset.ticker}
          </span>
        )}
      </div>

      {/* Asset Selector - larger for desktop workspace */}
      <AssetSelector
        selectedAsset={payAsset}
        onSelect={onPayAssetChange}
        assets={assets}
        placeholder="Select asset to pay"
        excludeAsset={receiveAsset}
        disabled={isCalculating || isSwapping}
        label="You Pay"
      />

      {/* Amount Input */}
      <div className="relative">
        <input
          type="text"
          value={payAmount}
          onChange={(e) => handlePayAmountChange(e.target.value)}
          placeholder="0.00000000"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white text-[28px] font-medium focus:outline-none focus:border-primary/50 transition-colors placeholder-charcoalGray/50"
          disabled={isCalculating || isSwapping || !payAsset}
          autoFocus
        />
        {isCalculating && (
          <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        )}
      </div>

      {/* Quick Amount Buttons + MAX */}
      {payAsset && (
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {[25, 50, 75].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => {
                const amount = (payAsset.balance * pct) / 100;
                onPayAmountChange(amount.toFixed(8));
              }}
              disabled={isCalculating || isSwapping}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-charcoalGray hover:text-white font-medium transition-colors disabled:opacity-50"
            >
              {pct}%
            </button>
          ))}
          <button
            type="button"
            onClick={onMaxClick}
            disabled={isCalculating || isSwapping || !payAmount}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/20 hover:bg-primary/30 text-sm text-primary font-medium transition-colors disabled:opacity-50"
          >
            <Maximize2 className="w-4 h-4" />
            MAX
          </button>
        </div>
      )}
    </div>
  );
}
