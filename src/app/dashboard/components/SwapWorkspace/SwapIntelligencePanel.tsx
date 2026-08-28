'use client';

import React from 'react';
import { SwapSummary } from './SwapIntelligence/SwapSummary';
import { MinimumReceived } from './SwapIntelligence/MinimumReceived';
import { RouteDisplay } from './SwapIntelligence/RouteDisplay';
import { SlippageSelector } from './SwapIntelligence/SlippageSelector';
import { SwapWarning } from './SwapIntelligence/SwapWarning';
import type { SwapQuote, SwapAsset } from '@/app/dashboard/components/SwapModal/types';

interface SwapIntelligencePanelProps {
  quote: SwapQuote | null;
  payAsset: SwapAsset | null;
  receiveAsset: SwapAsset | null;
  minimumReceived: number;
  slippage: number;
  onSlippageChange: (slippage: number) => void;
  isCalculating: boolean;
}

export function SwapIntelligencePanel({
  quote,
  payAsset,
  receiveAsset,
  minimumReceived,
  slippage,
  onSlippageChange,
  isCalculating,
}: SwapIntelligencePanelProps) {
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
