'use client';

import React from 'react';
import { ArrowRightLeft } from 'lucide-react';
import type { TradeMode } from '../shared/types';

interface SwapTabsProps {
  tradeMode: TradeMode;
  onTradeModeChange: (mode: TradeMode) => void;
}

export function SwapTabs({ tradeMode, onTradeModeChange }: SwapTabsProps) {
  return (
    <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl">
      <button
        type="button"
        onClick={() => onTradeModeChange('instant')}
        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
          tradeMode === 'instant'
            ? 'bg-primary text-white'
            : 'text-charcoalGray hover:text-white hover:bg-white/5'
        }`}
      >
        <ArrowRightLeft className="w-4 h-4" />
        Instant Swap
      </button>
      <button
        type="button"
        onClick={() => onTradeModeChange('limit-order')}
        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
          tradeMode === 'limit-order'
            ? 'bg-primary text-white'
            : 'text-charcoalGray hover:text-white hover:bg-white/5'
        }`}
      >
        Limit Order
      </button>
    </div>
  );
}