'use client';

import React from 'react';
import { ChevronRight, TrendingDown, TrendingUp } from 'lucide-react';
import { useCryptoPricesGlobal } from '@/context/CryptoPriceContext';

interface MarketMetric {
  label: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
}

const getChangeIcon = (type: MarketMetric['changeType']) => {
  switch (type) {
    case 'positive':
      return TrendingUp;
    case 'negative':
      return TrendingDown;
    default:
      return TrendingDown; // neutral not used, fallback
  }
};

const getChangeColor = (type: MarketMetric['changeType']) => {
  switch (type) {
    case 'positive':
      return 'text-green-400';
    case 'negative':
      return 'text-red-400';
    default:
      return 'text-charcoalGray';
  }
};

export default function MarketOverviewCard() {
  const { prices, isLoading } = useCryptoPricesGlobal();

  const marketMetrics: MarketMetric[] = React.useMemo(() => {
    if (!prices) return [];
    const items = [
      { label: 'Bitcoin', value: prices.bitcoin?.usd, change: prices.bitcoin?.usd_24h_change },
      { label: 'Ethereum', value: prices.ethereum?.usd, change: prices.ethereum?.usd_24h_change },
      { label: 'Solana', value: prices.solana?.usd, change: prices.solana?.usd_24h_change },
    ];

    return items
      .filter((item) => typeof item.value === 'number')
      .map((item) => ({
        label: item.label,
        value: `$${Number(item.value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
        change: `${Number(item.change ?? 0) >= 0 ? '+' : ''}${Number(item.change ?? 0).toFixed(2)}%`,
        changeType: Number(item.change ?? 0) >= 0 ? 'positive' : 'negative',
      }));
  }, [prices]);

  return (
    <div className="bg-deepSlate/50 border border-white/5 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white">Market Overview</h3>
        <button className="text-xs font-medium text-charcoalGray hover:text-white transition-colors flex items-center gap-1">
          View All
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-16 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-16 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-16 rounded-lg bg-white/5 animate-pulse" />
        </div>
      ) : marketMetrics.length === 0 ? (
        <p className="text-sm text-charcoalGray">No live market data available.</p>
      ) : (
        <div className="space-y-3">
          {marketMetrics.map((metric) => {
          const ChangeIcon = getChangeIcon(metric.changeType);
          return (
            <div
              key={metric.label}
              className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-charcoalGray truncate">{metric.label}</p>
                <p className="text-sm font-semibold text-white mt-0.5 truncate">{metric.value}</p>
              </div>
              <div className="flex-shrink-0 ml-4 flex items-center gap-1.5">
                <span className={`text-sm font-medium ${getChangeColor(metric.changeType)}`}>
                  <ChangeIcon className="w-3.5 h-3.5 inline-block align-middle" />
                  {metric.change}
                </span>
              </div>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}
