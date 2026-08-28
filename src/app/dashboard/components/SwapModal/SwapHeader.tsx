'use client';

import React from 'react';
import { X } from 'lucide-react';
import type { TradeMode } from './types';

interface SwapHeaderProps {
  tradeMode: TradeMode;
  onTradeModeChange: (mode: TradeMode) => void;
  onClose: () => void;
}

const tabs: { id: TradeMode; label: string }[] = [
  { id: 'instant', label: 'Instant Swap' },
  { id: 'limit-order', label: 'Limit Order' },
];

export default function SwapHeader({ tradeMode, onTradeModeChange, onClose }: SwapHeaderProps) {
  return (
    <div className="p-6 pb-4 border-b border-white/5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Swap</h2>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
          aria-label="Close swap modal"
        >
          <X className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        {tabs.map((tab) => {
          const active = tradeMode === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTradeModeChange(tab.id)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                active
                  ? 'bg-primary/20 text-primary shadow-sm'
                  : 'text-charcoalGray hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}