'use client';

import React, { useState } from 'react';
import { Info } from 'lucide-react';

const SLIPPAGE_OPTIONS = [0.1, 0.5, 1, 2];

interface SlippageSelectorProps {
  slippage: number;
  onSlippageChange: (slippage: number) => void;
}

export function SlippageSelector({ slippage, onSlippageChange }: SlippageSelectorProps) {
  const [customSlippage, setCustomSlippage] = useState(false);
  const [customValue, setCustomValue] = useState('');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Slippage Tolerance</span>
        <span className="text-xs text-primary font-medium">{slippage}%</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SLIPPAGE_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setCustomSlippage(false);
              onSlippageChange(option);
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              !customSlippage && slippage === option
                ? 'bg-primary/20 text-primary border border-primary/30'
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
            max="50"
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
            className="w-20 px-3 py-1.5 rounded-lg bg-white/5 border border-primary/30 text-sm text-white focus:outline-none focus:border-primary/50"
          />
        ) : (
          <button
            type="button"
            onClick={() => setCustomSlippage(true)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              customSlippage
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'text-charcoalGray hover:text-white hover:bg-white/5'
            }`}
          >
            Custom
          </button>
        )}
      </div>

      <div className="flex items-start gap-2 p-3 bg-white/5 rounded-lg">
        <Info className="w-4 h-4 text-charcoalGray flex-shrink-0 mt-0.5" />
        <p className="text-xs text-charcoalGray">
          During or before execution, price may move more than selected value.
        </p>
      </div>
    </div>
  );
}
