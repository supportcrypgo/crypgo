'use client';

import React from 'react';
import { SwapExecutionPanel } from './SwapExecutionPanel';
import { SwapIntelligencePanel } from './SwapIntelligencePanel';
import { useSwapWorkspace } from './useSwapWorkspace';

export function SwapWorkspace() {
  const {
    tradeMode,
    setTradeMode,
    payAsset,
    setPayAsset,
    receiveAsset,
    setReceiveAsset,
    availableAssets,
    payAmount,
    setPayAmount,
    slippage,
    setSlippage,
    isSwapping,
    swapResult,
    error,
    isCalculating,
    quote,
    receiveAmount,
    minimumReceived,
    isValid,
    handleSwapDirection,
    handleQuickAmount,
    handleMax,
    handleSwap,
    handleSuccessClose,
    handleRetry,
  } = useSwapWorkspace();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(420px,1.25fr)_minmax(300px,0.8fr)] gap-4 max-w-[1400px] mx-auto h-full">
      {/* Column 1 - Execution */}
      <SwapExecutionPanel
        tradeMode={tradeMode}
        setTradeMode={setTradeMode}
        payAsset={payAsset}
        setPayAsset={setPayAsset}
        receiveAsset={receiveAsset}
        setReceiveAsset={setReceiveAsset}
        assets={availableAssets}
        payAmount={payAmount}
        setPayAmount={setPayAmount}
        slippage={slippage}
        setSlippage={setSlippage}
        isCalculating={isCalculating}
        isSwapping={isSwapping}
        quote={quote}
        receiveAmount={receiveAmount}
        minimumReceived={minimumReceived}
        isValid={isValid}
        swapResult={swapResult}
        error={error}
        handleSwapDirection={handleSwapDirection}
        handleQuickAmount={handleQuickAmount}
        handleMax={handleMax}
        handleSwap={handleSwap}
        handleSuccessClose={handleSuccessClose}
        handleRetry={handleRetry}
      />
      
      {/* Column 2 - Intelligence */}
      <div className="hidden lg:block lg:col-span-1 min-w-0">
        <SwapIntelligencePanel
          quote={quote}
          payAsset={payAsset}
          receiveAsset={receiveAsset}
          minimumReceived={minimumReceived}
          slippage={slippage}
          onSlippageChange={setSlippage}
          isCalculating={isCalculating}
        />
      </div>
    </div>
  );
}
