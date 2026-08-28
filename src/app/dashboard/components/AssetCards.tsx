'use client';

import React, { useRef } from 'react';
import AssetCard from './AssetCard';
import { Asset } from './types';

interface AssetCardsProps {
  assets: Asset[];
  isLoading: boolean;
  isDesktop?: boolean;
}

function AssetCardSkeleton() {
  return (
    <div className="min-w-[175px] h-[260px] bg-deepSlate/50 rounded-[24px] p-4 flex flex-col justify-between animate-pulse border border-deepSlate/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-darkmode" />
          <div className="space-y-1.5">
            <div className="w-16 h-3 bg-darkmode rounded" />
            <div className="w-8 h-2 bg-darkmode rounded" />
          </div>
        </div>
        <div className="w-7 h-7 rounded-full bg-darkmode" />
      </div>
      <div className="mt-2">
        <div className="w-24 h-6 bg-darkmode rounded" />
      </div>
      <div className="flex items-end justify-between mt-auto">
        <div className="w-[100px] h-[60px] bg-darkmode rounded" />
        <div className="w-14 h-5 bg-darkmode rounded" />
      </div>
    </div>
  );
}

function MiniSparklineDesktop({ change24h }: { change24h: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const points = 20;
    const data: number[] = [];
    const isPositive = change24h >= 0;
    const magnitude = Math.min(Math.abs(change24h) / 10, 1); // cap at 10% = full scale
    const midY = height / 2;

    // Deterministic trend derived from the real 24h change
    for (let i = 0; i < points; i++) {
      const progress = i / (points - 1);
      const offset = (progress - 0.5) * magnitude * height * 0.8;
      const y = midY - offset;
      data.push(y);
    }

    ctx.beginPath();
    ctx.strokeStyle = isPositive ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const stepX = width / (points - 1);
    data.forEach((point, i) => {
      const x = i * stepX;
      if (i === 0) ctx.moveTo(x, point);
      else ctx.lineTo(x, point);
    });
    ctx.stroke();
  }, [change24h]);

  return (
    <canvas
      ref={canvasRef}
      width={70}
      height={32}
      className="w-[70px] h-[32px]"
    />
  );
}

export default function AssetCards({ assets, isLoading, isDesktop = false }: AssetCardsProps) {
  if (isDesktop) {
    return (
      <div className="grid grid-cols-4 gap-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[130px] bg-deepSlate/50 rounded-[20px] p-4 flex flex-col justify-between animate-pulse border border-deepSlate/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-darkmode" />
                    <div className="space-y-1.5">
                      <div className="w-14 h-3 bg-darkmode rounded" />
                      <div className="w-7 h-2 bg-darkmode rounded" />
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-darkmode" />
                </div>
                <div className="flex items-end justify-between mt-auto">
                  <div className="w-20 h-6 bg-darkmode rounded" />
                  <div className="flex items-center gap-2">
                    <div className="w-[60px] h-8 bg-darkmode rounded" />
                    <div className="w-12 h-5 bg-darkmode rounded" />
                  </div>
                </div>
              </div>
            ))
          : assets.map((asset) => (
              <div key={asset.id} className="h-[130px] bg-deepSlate rounded-[20px] p-4 flex flex-col justify-between border border-deepSlate/50 hover:border-primary/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-darkmode flex items-center justify-center overflow-hidden">
                      <img src={asset.logo} alt={asset.name} className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white leading-tight">{asset.name}</p>
                      <p className="text-[10px] text-charcoalGray">{asset.ticker}</p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${asset.change24h >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    <svg
                      className={`w-3.5 h-3.5 ${asset.change24h >= 0 ? 'text-green-400' : 'text-red-400'} ${asset.change24h >= 0 ? '' : 'rotate-180'}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-end justify-between mt-auto">
                  <p className="text-lg font-bold text-white">${asset.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <div className="flex items-center gap-2">
                    <MiniSparklineDesktop change24h={asset.change24h} />
                    <span className={`text-xs font-semibold ${asset.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {asset.change24h >= 0 ? '+' : ''}{asset.change24h.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            ))
        }
      </div>
    );
  }

  return (
    <div className="overflow-x-auto scrollbar-hide -mx-5 px-5">
      <div className="flex gap-3 snap-x snap-mandatory">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <AssetCardSkeleton key={i} />)
          : assets.map((asset) => <AssetCard key={asset.id} asset={asset} />)
        }
        {/* Show next card peek indicator */}
        <div className="min-w-[12px] shrink-0" />
      </div>
    </div>
  );
}