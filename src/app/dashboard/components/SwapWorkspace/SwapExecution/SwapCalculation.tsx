'use client';

import React, { useState } from 'react';
import { Info, Loader2 } from 'lucide-react';
import type { SwapQuote, SwapAsset } from '../shared/types';

interface SwapCalculationProps {
  quote: SwapQuote | null;
  isCalculating: boolean;
  receiveAmount: number;
  minimumReceived: number;
  payAmount: string;
  slippage: number;
  onSlippageChange: (slippage: number) => void;
}

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);

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

const SLIPPAGE_OPTIONS = [0.1, 0.5, 1];

export function SwapCalculation({
  quote,
  isCalculating,
  receiveAmount,
  minimumReceived,
  payAmount,
  slippage,
  onSlippageChange,
}: SwapCalculationProps) {
  const [customSlippage, setCustomSlippage] = useState(false);
  const [customValue, setCustomValue] = useState('');

const formatAmount = (value: number, ticker: string) => {
    if (!ticker) return '';
    return `${value.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${ticker}`;
  };

  const priceImpactColor =
    (quote?.priceImpact ?? 0) < 1
      ? 'text-success'
      : (quote?.priceImpact ?? 0) < 3
      ? 'text-warning'
      : 'text-error';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {isCalculating && (
          <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
            <span className="text-xs text-charcoalGray">Calculating...</span>
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        {/* Rate */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-xs text-charcoalGray flex items-center gap-1.5">
            Rate
            <Tooltip text="The market exchange rate between the pay and receive assets." />
          </span>
          <span className="text-xs text-white font-medium">
            {quote
              ? `Rate: ${quote.rate.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
              : '—'}
          </span>
        </div>

        {/* Receive Amount */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-xs text-charcoalGray flex items-center gap-1.5">
            You Receive
            <Tooltip text="Estimated amount you'll receive after fees." />
          </span>
          <span className="text-xs text-white font-medium">
            {quote ? `${receiveAmount.toLocaleString(undefined, { maximumFractionDigits: 8 })}` : '—'}
          </span>
        </div>

        {/* Minimum Received */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-xs text-charcoalGray flex items-center gap-1.5">
            Minimum Received
            <Tooltip text="Minimum amount guaranteed with slippage protection." />
          </span>
          <span className="text-xs text-white font-medium">
            {quote ? `${minimumReceived.toLocaleString(undefined, { maximumFractionDigits: 8 })}` : '—'}
          </span>
        </div>

        {/* Estimated Fee */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-xs text-charcoalGray flex items-center gap-1.5">
            Estimated Fee
            <Tooltip text="Crypgo charges a 0.3% network fee on swaps." />
          </span>
          <span className="text-xs text-white font-medium">
            {quote
              ? formatAmount(quote.fee, quote.feeAssetTicker)
              : '—'}
          </span>
        </div>

        {/* Price Impact */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-xs text-charcoalGray flex items-center gap-1.5">
            Price Impact
            <Tooltip text="The estimated effect your trade has on the market price." />
          </span>
          <span className={`text-xs font-medium ${priceImpactColor}`}>
            {quote ? `${quote.priceImpact.toFixed(2)}%` : '—'}
          </span>
        </div>

        {/* Slippage Tolerance */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-xs text-charcoalGray flex items-center gap-1.5">
            Slippage Tolerance
            <Tooltip text="Your swap will revert if price moves more than this amount during execution." />
          </span>
          <div className="flex items-center gap-1">
            {SLIPPAGE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setCustomSlippage(false);
                  onSlippageChange(option);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  !customSlippage && slippage === option
                    ? 'bg-primary/20 text-primary'
                    : 'text-charcoalGray hover:text-white hover:bg-white/5'
                }`}
              >
                {option}%
              </button>
            ))}
            {customSlippage ? (
              <input
                autoFocus
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={customValue}
                onChange={(e) => {
                  setCustomValue(e.target.value);
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) onSlippageChange(val);
                }}
                onBlur={() => {
                  if (!customValue) {
                    setCustomSlippage(false);
                    onSlippageChange(0.5);
                  }
                }}
                className="w-16 px-2 py-1 rounded-lg bg-white/5 border border-primary/30 text-xs text-white focus:outline-none focus:border-primary/50"
              />
            ) : (
              <button
                type="button"
                onClick={() => setCustomSlippage(true)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  customSlippage
                    ? 'bg-primary/20 text-primary'
                    : 'text-charcoalGray hover:text-white hover:bg-white/5'
                }`}
              >
                Custom
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
