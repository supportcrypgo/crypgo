'use client';

import React from 'react';
import { Asset } from './types';

interface PortfolioRowProps {
  asset: Asset;
  compact?: boolean;
  editable?: boolean;
  editValue?: string;
  onQuantityChange?: (assetId: string, value: string) => void;
  onQuantityBlur?: (assetId: string, ticker: string) => void;
}

export default function PortfolioRow({ asset, compact = false, editable = false, editValue, onQuantityChange, onQuantityBlur }: PortfolioRowProps) {
  const isPositive = asset.change24h >= 0;
  const displayQty = editValue !== undefined ? editValue : asset.quantity.toString();

  // Shared quantity input for edit mode
  const renderQuantityInput = () => {
    if (!editable) return null;
    return (
      <input
        type="number"
        step="any"
        min="0"
        value={displayQty}
        onChange={(e) => onQuantityChange?.(asset.id, e.target.value)}
        onBlur={() => onQuantityBlur?.(asset.id, asset.ticker)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-20 text-right text-sm font-semibold text-white bg-darkmode/60 border border-primary/30 rounded-lg px-2 py-1 focus:outline-none focus:border-primary/60"
      />
    );
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between py-3 px-3 hover:bg-darkmode/50 rounded-lg transition-colors cursor-pointer">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-darkmode flex items-center justify-center overflow-hidden shrink-0">
            <img src={asset.logo} alt={asset.name} className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{asset.name}</p>
            <p className="text-[10px] text-charcoalGray">{asset.ticker}</p>
          </div>
        </div>
        <div className="text-right">
          {editable ? (
            renderQuantityInput()
          ) : (
            <>
              <p className="text-sm font-semibold text-white">{asset.percentage.toFixed(1)}%</p>
              <span className={`text-[10px] font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {isPositive ? '+' : ''}{asset.change24h.toFixed(2)}%
              </span>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between h-[68px] px-1 border-b border-deepSlate/50 last:border-b-0">
      {/* Left: Icon + Name + Ticker */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-darkmode flex items-center justify-center overflow-hidden shrink-0">
          <img src={asset.logo} alt={asset.name} className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">{asset.name}</p>
          <p className="text-[11px] text-charcoalGray">{asset.ticker}</p>
        </div>
      </div>

      {/* Right: Quantity input or Percentage + ROI + Arrow */}
      <div className="flex items-center gap-4">
        {editable ? (
          renderQuantityInput()
        ) : (
          <>
            <div className="text-right">
              <p className="text-sm font-semibold text-white">{asset.percentage.toFixed(1)}%</p>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-md min-w-[60px] text-center ${
              isPositive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {isPositive ? '+' : ''}{asset.change24h.toFixed(2)}%
            </span>
          </>
        )}
        <svg className="w-4 h-4 text-charcoalGray" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </div>
  );
}