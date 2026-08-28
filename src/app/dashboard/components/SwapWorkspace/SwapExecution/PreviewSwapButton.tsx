'use client';

import React from 'react';
import { RefreshCw, RotateCcw, CheckCircle2 } from 'lucide-react';
import type { SwapQuote, SwapAsset, QuickSwapResult } from '../shared/types';

interface PreviewSwapButtonProps {
  quote: SwapQuote | null;
  isSwapping: boolean;
  isValid: boolean;
  isCalculating: boolean;
  swapResult: QuickSwapResult | null;
  error: string;
  onSwap: () => void;
  onSuccessClose: () => void;
  onRetry: () => void;
}

export function PreviewSwapButton({
  quote,
  isSwapping,
  isValid,
  isCalculating,
  swapResult,
  error,
  onSwap,
  onSuccessClose,
  onRetry,
}: PreviewSwapButtonProps) {
  const formatAmount = (value: number, ticker: string) => {
    return `${value.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${ticker}`;
  };

  // Success State
  if (swapResult) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <p className="text-lg text-white font-semibold text-center">Swap Successful!</p>
          <p className="text-xs text-charcoalGray text-center">Transaction completed</p>
        </div>
        
        <div className="space-y-3 p-4 bg-white/3 rounded-xl border border-white/5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-charcoalGray">Transaction ID</span>
            <span className="text-white font-mono truncate max-w-[180px]">{swapResult.txId}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-charcoalGray">Date</span>
            <span className="text-white">{new Date(swapResult.date).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-charcoalGray">Rate</span>
            <span className="text-white">{swapResult.rate}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-charcoalGray">Network Fee</span>
            <span className="text-white">{swapResult.fee.toFixed(6)} {swapResult.payTicker}</span>
          </div>
        </div>

        <button
          onClick={onSuccessClose}
          className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-5 h-5" />
          <span>Done</span>
        </button>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-16 h-16 rounded-full bg-error/20 flex items-center justify-center">
            <RotateCcw className="w-8 h-8 text-error" />
          </div>
          <p className="text-lg text-white font-semibold text-center">Swap Failed</p>
          <p className="text-xs text-charcoalGray text-center">{error}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onRetry}
            className="flex-1 bg-white/5 hover:bg-white/10 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 border border-white/10"
          >
            <RotateCcw className="w-5 h-5" />
            <span>Retry</span>
          </button>
          <button
            onClick={onSuccessClose}
            className="flex-1 bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Close</span>
          </button>
        </div>
      </div>
    );
  }

  // Swapping State
  if (isSwapping) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-4 py-4">
          <RefreshCw className="w-10 h-10 text-primary animate-spin" />
          <p className="text-sm text-white leading-relaxed text-center">
            Executing swap...
          </p>
          <p className="text-xs text-charcoalGray text-center">
            Please wait while we process your transaction
          </p>
        </div>
      </div>
    );
  }

  // Just the swap button
  return (
    <div>
      <button
        onClick={onSwap}
        disabled={!isValid || isCalculating}
        className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {!isCalculating && <RefreshCw className="w-5 h-5" />}
        <span>Swap</span>
      </button>
    </div>
  );
}
