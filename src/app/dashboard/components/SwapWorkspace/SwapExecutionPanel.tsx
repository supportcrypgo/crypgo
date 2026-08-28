'use client';

import React from 'react';
import { SwapTabs } from './SwapExecution/SwapTabs';
import { PayAssetInput } from './SwapExecution/PayAssetInput';
import { ReceiveAssetInput } from './SwapExecution/ReceiveAssetInput';
import SwapDirectionButton from './shared/SwapDirectionButton';
import { PreviewSwapButton } from './SwapExecution/PreviewSwapButton';
import type { TradeMode, SwapAsset, SwapQuote, QuickSwapResult } from './shared/types';

interface SwapExecutionPanelProps {
  tradeMode: TradeMode;
  payAsset: SwapAsset | null;
  receiveAsset: SwapAsset | null;
  assets: SwapAsset[];
  payAmount: string;
  slippage: number;
  isCalculating: boolean;
  isSwapping: boolean;
  quote: SwapQuote | null;
  receiveAmount: number;
  minimumReceived: number;
  isValid: boolean;
  swapResult: QuickSwapResult | null;
  error: string;
  setTradeMode: (mode: TradeMode) => void;
  setPayAsset: (asset: SwapAsset | null) => void;
  setReceiveAsset: (asset: SwapAsset | null) => void;
  setPayAmount: (amount: string) => void;
  setSlippage: (value: number) => void;
  handleSwapDirection: () => void;
  handleQuickAmount: (percent: number) => void;
  handleMax: () => void;
  handleSwap: () => void;
  handleSuccessClose: () => void;
  handleRetry: () => void;
}

export function SwapExecutionPanel({
  tradeMode,
  payAsset,
  receiveAsset,
  assets,
  payAmount,
  slippage,
  isCalculating,
  isSwapping,
  quote,
  receiveAmount,
  minimumReceived,
  isValid,
  swapResult,
  error,
  setTradeMode,
  setPayAsset,
  setReceiveAsset,
  setPayAmount,
  setSlippage,
  handleSwapDirection,
  handleQuickAmount,
  handleMax,
  handleSwap,
  handleSuccessClose,
  handleRetry,
}: SwapExecutionPanelProps) {
  const handlePayAssetChange = (asset: SwapAsset | null) => setPayAsset(asset);
  const handleReceiveAssetChange = (asset: SwapAsset | null) => setReceiveAsset(asset);
  const handlePayAmountChange = (amount: string) => setPayAmount(amount);
  const handleSlippageChange = (value: number) => setSlippage(value);
  const handleTradeModeChange = (mode: TradeMode) => setTradeMode(mode);
  return (
    <div className="flex flex-col gap-4">
      <SwapTabs tradeMode={tradeMode} onTradeModeChange={handleTradeModeChange} />
      
      <div className="flex flex-col gap-5">
        <PayAssetInput
          payAsset={payAsset}
          receiveAsset={receiveAsset}
          assets={assets}
          payAmount={payAmount}
          isCalculating={isCalculating}
          isSwapping={isSwapping}
          onPayAssetChange={handlePayAssetChange}
          onPayAmountChange={handlePayAmountChange}
          onMaxClick={handleMax}
        />
        
        <div className="flex justify-center">
          <SwapDirectionButton 
            onClick={handleSwapDirection} 
            disabled={isCalculating || isSwapping || !payAsset || !receiveAsset}
          />
        </div>
        
        <ReceiveAssetInput
          receiveAsset={receiveAsset}
          assets={assets}
          quoteAmount={receiveAmount}
          isCalculating={isCalculating}
          isSwapping={isSwapping}
          excludedAsset={payAsset}
          onSelectAsset={handleReceiveAssetChange}
        />
        
        <div className="h-[1px] bg-deepSlate/50" />
        
        <div className="flex-1" />
        
        <PreviewSwapButton
          quote={quote}
          isSwapping={isSwapping}
          isValid={isValid}
          isCalculating={isCalculating}
          swapResult={swapResult}
          error={error}
          onSwap={handleSwap}
          onSuccessClose={handleSuccessClose}
          onRetry={handleRetry}
        />
      </div>
    </div>
  );
}
