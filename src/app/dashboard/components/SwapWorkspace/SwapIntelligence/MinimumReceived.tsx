'use client';

import React from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import type { SwapQuote } from '@/app/dashboard/components/SwapModal/types';

interface MinimumReceivedProps {
  quote: SwapQuote | null;
  receiveAssetTicker: string | null;
  slippage: number;
}

export function MinimumReceived({ quote, receiveAssetTicker, slippage }: MinimumReceivedProps) {
  const minimumReceived = quote?.minimumReceived ?? 0;
  const receiveAmount = quote?.receiveAmount ?? 0;
  const difference = receiveAmount - minimumReceived;
  const differencePercent = receiveAmount > 0 ? (difference / receiveAmount) * 100 : 0;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-white">Slippage Protection</h2>
      
      <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-warning/20 text-warning">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-white">Minimum Guaranteed</p>
            <p className="text-xs text-charcoalGray">With {slippage}% slippage tolerance</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-white">
            {minimumReceived > 0 && receiveAssetTicker
              ? `${minimumReceived.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${receiveAssetTicker}`
              : '—'}
          </p>
        </div>
      </div>

      {minimumReceived > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-charcoalGray">Estimated Receive</span>
            <span className="text-white font-medium">
              {receiveAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {receiveAssetTicker}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-charcoalGray">Slippage Buffer</span>
            <span className="text-warning font-medium">
              -{difference.toLocaleString(undefined, { maximumFractionDigits: 6 })} {receiveAssetTicker} ({differencePercent.toFixed(2)}%)
            </span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div 
              className="bg-success h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (minimumReceived / receiveAmount) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-white/5">
        <p className="text-xs text-charcoalGray">
          Your transaction will revert if the received amount drops below the minimum guaranteed amount due to price movement during execution.
        </p>
      </div>
    </div>
  );
}
