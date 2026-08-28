'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { SwapQuote } from '@/app/dashboard/components/SwapModal/types';

interface PriceImpactProps {
  quote: SwapQuote | null;
}

export function PriceImpact({ quote }: PriceImpactProps) {
  const priceImpact = quote?.priceImpact ?? 0;

  const getImpactIcon = () => {
    if (priceImpact === 0) return <Minus className="w-4 h-4" />;
    if (priceImpact < 1) return <TrendingDown className="w-4 h-4" />;
    if (priceImpact < 3) return <TrendingUp className="w-4 h-4" />;
    return <TrendingUp className="w-4 h-4" />;
  };

  const getImpactColor = () => {
    if (priceImpact === 0) return 'text-charcoalGray';
    if (priceImpact < 1) return 'text-success';
    if (priceImpact < 3) return 'text-warning';
    return 'text-error';
  };

  const getImpactLabel = () => {
    if (priceImpact === 0) return 'None';
    if (priceImpact < 1) return 'Low';
    if (priceImpact < 3) return 'Medium';
    return 'High';
  };

  const getImpactDescription = () => {
    if (priceImpact === 0) return 'No market impact';
    if (priceImpact < 1) return 'Minimal effect on price';
    if (priceImpact < 3) return 'Noticeable price movement';
    return 'Significant price movement';
  };

  const progressColor = priceImpact < 1 ? 'bg-success' : priceImpact < 3 ? 'bg-warning' : 'bg-error';
  const progressWidth = Math.min(priceImpact * 20, 100);

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-white">Price Impact</h2>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg bg-white/5 ${getImpactColor()} bg-opacity-20`}>
            {getImpactIcon()}
          </div>
          <div>
            <p className="text-xs font-medium text-white">Impact Level</p>
            <p className="text-xs text-charcoalGray">{getImpactLabel()}</p>
          </div>
        </div>
        <span className={`text-sm font-bold ${getImpactColor()}`}>
          {priceImpact.toFixed(2)}%
        </span>
      </div>

      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div 
          className={`${progressColor} h-full rounded-full transition-all duration-500`}
          style={{ width: `${progressWidth}%` }}
        />
      </div>

      <p className="text-xs text-charcoalGray">{getImpactDescription()}</p>

      {quote && (
        <div className="pt-2 border-t border-white/5">
          <p className="text-xs text-charcoalGray">
            Your trade of {quote.receiveAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {quote.route.split(' → ')[1] || 'asset'} may shift the market price by approximately <span className="font-medium text-white">{priceImpact.toFixed(2)}%</span>.
          </p>
        </div>
      )}
    </div>
  );
}
