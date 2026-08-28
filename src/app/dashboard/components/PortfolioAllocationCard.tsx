'use client';

import React from 'react';
import { Asset } from './types';
import { ChevronRight } from 'lucide-react';

interface PortfolioAllocationCardProps {
  assets: Asset[];
}

export default function PortfolioAllocationCard({ assets }: PortfolioAllocationCardProps) {
  // Filter assets with value > 0 and sort by percentage descending
  const sortedAssets = [...assets]
    .filter((a) => a.percentage > 0)
    .sort((a, b) => b.percentage - a.percentage);

  // Take top 4, group rest as "Others"
  const topAssets = sortedAssets.slice(0, 4);
  const othersPercentage = sortedAssets.slice(4).reduce((sum, a) => sum + a.percentage, 0);

  const displayAssets = othersPercentage > 0
    ? [...topAssets, { ...sortedAssets[0], id: 'others', ticker: 'Others', name: 'Others', logo: '', percentage: othersPercentage, price: 0, value: 0, change24h: 0, quantity: 0 }]
    : topAssets;

  // Colors for each asset (consistent with typical crypto colors)
  const assetColors: Record<string, string> = {
    BTC: '#F7931A',
    ETH: '#627EEA',
    BNB: '#F3BA2F',
    SOL: '#00FFA3',
    Others: '#6B7280',
  };

  const totalPercentage = displayAssets.reduce((sum, a) => sum + a.percentage, 0);

  // Build conic-gradient segments
  let currentAngle = 0;
  const gradientSegments = displayAssets.map((asset, index) => {
    const color = assetColors[asset.ticker] || assetColors.Others;
    const start = currentAngle;
    const end = currentAngle + (asset.percentage / totalPercentage) * 360;
    currentAngle = end;
    return `${color} ${start}deg ${end}deg`;
  });

  const gradientString = `conic-gradient(${gradientSegments.join(', ')})`;

  return (
    <div className="bg-deepSlate/50 border border-white/5 rounded-xl p-6 h-[240px] flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-white">Portfolio Allocation</h3>
        <button className="text-xs font-medium text-charcoalGray hover:text-white transition-colors flex items-center gap-1">
          View All
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-between gap-6 min-h-0">
        {/* Donut Chart */}
        <div className="flex-shrink-0 relative w-[150px] h-[150px]">
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: gradientString }}
          />
          {/* Center cutout for donut effect */}
          <div className="absolute inset-[24px] bg-deepSlate/50 rounded-full border border-white/5" />

          {/* Center label */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{totalPercentage.toFixed(1)}%</p>
              <p className="text-xs text-charcoalGray mt-0.5">Allocated</p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-2.5">
          {displayAssets.map((asset, index) => {
            const color = assetColors[asset.ticker] || assetColors.Others;
            return (
              <div key={asset.id} className="flex items-center gap-3 min-w-0">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: color }}
                />
                <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {asset.logo && (
                      <img
                        src={asset.logo}
                        alt={asset.ticker}
                        className="w-4 h-4 rounded-full object-contain"
                      />
                    )}
                    <span className="text-sm font-medium text-white truncate">
                      {asset.ticker}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-white whitespace-nowrap text-right">
                    {asset.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}