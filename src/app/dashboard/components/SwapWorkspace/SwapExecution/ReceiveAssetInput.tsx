'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import AssetSelector from '../shared/AssetSelector';
import type { SwapAsset } from '../shared/types';

interface ReceiveAssetInputProps {
  receiveAsset: SwapAsset | null;
  assets: SwapAsset[];
  quoteAmount: number | null;
  isCalculating: boolean;
  isSwapping: boolean;
  excludedAsset?: SwapAsset | null;
  onSelectAsset: (asset: SwapAsset | null) => void;
}

export function ReceiveAssetInput({
  receiveAsset,
  assets,
  quoteAmount,
  isCalculating,
  isSwapping,
  excludedAsset,
  onSelectAsset,
}: ReceiveAssetInputProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-charcoalGray uppercase tracking-wide">You Receive</span>
        <span className="text-xs text-charcoalGray">
          {receiveAsset && !isCalculating ? 'Estimated' : '—'}
        </span>
      </div>

      {/* Asset Selector */}
      <AssetSelector
        selectedAsset={receiveAsset}
        onSelect={onSelectAsset}
        assets={assets}
        placeholder="Select asset to receive"
        excludeAsset={excludedAsset}
        disabled={isCalculating || isSwapping}
        label="You Receive"
      />

      {/* Amount Display */}
      <div className="relative">
        <div className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 h-[76px]">
          {isCalculating ? (
            <div className="flex items-center justify-center gap-3 h-full">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <span className="text-base font-bold text-white">Calculating...</span>
            </div>
          ) : receiveAsset && quoteAmount !== null ? (
            <div className="h-full flex flex-col justify-between">
              <div>
                <p className="text-[28px] font-medium text-white">
                  {quoteAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })}{' '}
                  <span className="text-lg font-medium text-charcoalGray">{receiveAsset.ticker}</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col justify-between">
              <div>
                <p className="text-[28px] font-medium text-white">
                  0.00000{' '}
                  {receiveAsset ? (
                    <span className="text-lg font-medium text-charcoalGray">{receiveAsset.ticker}</span>
                  ) : null}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
