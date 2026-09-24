'use client';

import React from 'react';
import { SwapSummary } from './SwapIntelligence/SwapSummary';
import { MinimumReceived } from './SwapIntelligence/MinimumReceived';
import { RouteDisplay } from './SwapIntelligence/RouteDisplay';
import { SlippageSelector } from './SwapIntelligence/SlippageSelector';
import { SwapWarning } from './SwapIntelligence/SwapWarning';
import type { SwapQuote, SwapAsset, QuickSwapResult } from '@/app/dashboard/components/SwapModal/types';

interface SwapIntelligencePanelProps {
  quote: SwapQuote | null;
  payAsset: SwapAsset | null;
  receiveAsset: SwapAsset | null;
  minimumReceived: number;
  slippage: number;
  onSlippageChange: (slippage: number) => void;
  isCalculating: boolean;
  swapResult: QuickSwapResult | null;
  onSuccessClose: () => void;
}

export function SwapIntelligencePanel({
  quote,
  payAsset,
  receiveAsset,
  minimumReceived,
  slippage,
  onSlippageChange,
  isCalculating,
  swapResult,
  onSuccessClose,
}: SwapIntelligencePanelProps) {
  if (swapResult) {
    return (
      <div className="min-h-[360px] flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/5 p-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <img src={swapResult.payTicker === payAsset?.ticker ? payAsset.logo : receiveAsset?.logo} alt={swapResult.payTicker} className="h-12 w-12 rounded-full border border-white/10 bg-white/5 shadow-lg shadow-primary/10" />
          <img src={swapResult.receiveTicker === receiveAsset?.ticker ? receiveAsset.logo : payAsset?.logo} alt={swapResult.receiveTicker} className="h-12 w-12 rounded-full border border-white/10 bg-white/5 shadow-lg shadow-primary/10" />
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white leading-none">
          {swapResult.payAmount.toLocaleString(undefined, { maximumFractionDigits: 8 })} {swapResult.payTicker} for {swapResult.receiveAmount.toLocaleString(undefined, { maximumFractionDigits: 8 })} {swapResult.receiveTicker}
        </h2>
        <p className="mt-3 max-w-[260px] text-sm leading-5 text-charcoalGray">Swap completed successfully</p>
        <button type="button" onClick={onSuccessClose} className="mt-8 w-full h-11 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors">
          OK
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="lg:bg-white/5 lg:border lg:border-white/5 lg:rounded-xl lg:overflow-hidden">
        <div className="space-y-4 lg:p-5">
          <SwapSummary
            quote={quote}
            payAsset={payAsset}
            receiveAsset={receiveAsset}
            minimumReceived={minimumReceived}
            isCalculating={isCalculating}
          />
        </div>
      </div>

      <div className="lg:bg-white/5 lg:border lg:border-white/5 lg:rounded-xl lg:overflow-hidden">
        <div className="space-y-4 lg:p-5">
          <MinimumReceived
            quote={quote}
            receiveAssetTicker={receiveAsset?.ticker ?? null}
            slippage={slippage}
          />
        </div>
      </div>

      <div className="lg:bg-white/5 lg:border lg:border-white/5 lg:rounded-xl lg:overflow-hidden">
        <div className="space-y-4 lg:p-5">
          <RouteDisplay quote={quote} />
        </div>
      </div>

      <div className="lg:bg-white/5 lg:border lg:border-white/5 lg:rounded-xl lg:overflow-hidden">
        <div className="space-y-4 lg:p-5">
          <SlippageSelector slippage={slippage} onSlippageChange={onSlippageChange} />
        </div>
      </div>

      <SwapWarning
        quote={quote}
        priceImpact={quote?.priceImpact ?? 0}
        slippage={slippage}
      />
    </div>
  );
}
