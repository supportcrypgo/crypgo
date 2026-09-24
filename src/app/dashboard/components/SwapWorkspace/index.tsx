'use client';

import React from 'react';
import { useUnified } from '@/context/UnifiedContext';
import { SwapExecutionPanel } from './SwapExecutionPanel';
import { SwapIntelligencePanel } from './SwapIntelligencePanel';
import { useSwapWorkspace } from './useSwapWorkspace';
import CautionModal from '@/components/CautionModal';

interface SwapWorkspaceProps {
  onSuccessPageChange?: (visible: boolean) => void;
  onSuccessDetailsChange?: (details: {
    fromAmount: string;
    fromTicker: string;
    fromLogo: string;
    toAmount: string;
    toTicker: string;
    toLogo: string;
  } | null) => void;
}

export function SwapWorkspace({
  onSuccessPageChange,
  onSuccessDetailsChange,
}: SwapWorkspaceProps) {
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
    cautionOpen,
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
    closeCaution,
  } = useSwapWorkspace();

  React.useEffect(() => {
    if (swapResult && payAsset && receiveAsset) {
      const details = {
        fromAmount: String(swapResult.payAmount),
        fromTicker: swapResult.payTicker,
        fromLogo: payAsset.logo,
        toAmount: String(swapResult.receiveAmount),
        toTicker: swapResult.receiveTicker,
        toLogo: receiveAsset.logo,
      };
      onSuccessDetailsChange?.(details);
      onSuccessPageChange?.(true);
      return;
    }

    if (!swapResult) {
      onSuccessDetailsChange?.(null);
      onSuccessPageChange?.(false);
    }
  }, [swapResult, payAsset, receiveAsset, onSuccessDetailsChange, onSuccessPageChange]);

  return (
    <>
      <CautionModal isOpen={cautionOpen} onClose={closeCaution} />
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
          swapResult={swapResult}
          onSuccessClose={handleSuccessClose}
        />
      </div>
      </div>
    </>
  );
}
