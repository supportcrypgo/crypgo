'use client';

import React from 'react';
import { Info, CheckCircle2 } from 'lucide-react';
import type { SwapQuote, SwapAsset } from '@/app/dashboard/components/SwapModal/types';

interface SwapSummaryProps {
  quote: SwapQuote | null;
  payAsset: SwapAsset | null;
  receiveAsset: SwapAsset | null;
  minimumReceived: number;
  isCalculating: boolean;
}

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = React.useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      <Info className="w-3.5 h-3.5 text-charcoalGray hover:text-gray-300 cursor-help" />
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 rounded-lg bg-dark_grey/95 text-[11px] leading-relaxed text-gray-300 shadow-xl border border-white/5 z-50">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-dark_grey/95" />
        </span>
      )}
    </span>
  );
}

export function SwapSummary({
  quote,
  payAsset,
  receiveAsset,
  minimumReceived,
  isCalculating,
}: SwapSummaryProps) {
  const formatAmount = (value: number, ticker: string) => {
    if (!value || !ticker) return '—';
    return `${value.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${ticker}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Transaction Details</h2>
        {quote && !isCalculating && (
          <span className="flex items-center gap-1.5 text-[11px] text-success">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Quote Ready
          </span>
        )}
      </div>

      <div className="space-y-2.5">
        {/* You Pay */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-xs text-charcoalGray flex items-center gap-1.5">
            You Pay
            <Tooltip text="The amount of the pay asset you are swapping." />
          </span>
          <span className="text-xs text-white font-medium">
            {payAsset && quote ? formatAmount(quote.receiveAmount / quote.rate, payAsset.ticker) : '—'}
          </span>
        </div>

        {/* You Receive */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-xs text-charcoalGray flex items-center gap-1.5">
            You Receive
            <Tooltip text="The estimated amount of the receive asset after fees." />
          </span>
          <span className="text-xs text-white font-medium">
            {receiveAsset && quote ? formatAmount(quote.receiveAmount, receiveAsset.ticker) : '—'}
          </span>
        </div>

        {/* Rate */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-xs text-charcoalGray flex items-center gap-1.5">
            Rate
            <Tooltip text="The market exchange rate between the two assets." />
          </span>
          <span className="text-xs text-white font-medium">
            {payAsset && receiveAsset && quote
              ? `1 ${payAsset.ticker} = ${quote.rate.toFixed(6)} ${receiveAsset.ticker}`
              : '—'}
          </span>
        </div>

        {/* Fee */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-xs text-charcoalGray flex items-center gap-1.5">
            Network Fee (0.3%)
            <Tooltip text="Crypgo charges a 0.3% fee per swap." />
          </span>
          <span className="text-xs text-white font-medium">
            {quote ? formatAmount(quote.fee, quote.feeAssetTicker) : '—'}
          </span>
        </div>

        {/* Slippage Protection */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-xs text-charcoalGray flex items-center gap-1.5">
            Slippage Protection
            <Tooltip text="The lowest amount you will receive after slippage." />
          </span>
          <span className="text-xs text-warning font-medium">
            {receiveAsset && minimumReceived > 0
              ? `${minimumReceived.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${receiveAsset.ticker}`
              : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
