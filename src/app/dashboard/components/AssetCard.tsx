'use client';

import React, { useEffect, useRef } from 'react';
import { Asset } from './types';
import Image from 'next/image';

interface AssetCardProps {
  asset: Asset;
}

/**
 * Draw a deterministic mini sparkline based on the real 24h change.
 * No random data - just a simple upward/downward line reflecting the actual trend.
 */
function drawTrendLine(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  change24h: number
) {
  ctx.clearRect(0, 0, width, height);

  const isPositive = change24h >= 0;
  const points = 20;
  const data: number[] = [];

  // Create a simple deterministic trend based on the 24h change magnitude
  const magnitude = Math.min(Math.abs(change24h) / 10, 1); // cap at 10% change = full scale
  const midY = height / 2;

  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    // Start at middle, end higher (positive) or lower (negative) based on change
    const offset = (progress - 0.5) * magnitude * height * 0.8;
    const y = midY - offset; // invert: higher value = lower y
    data.push(y);
  }

  ctx.beginPath();
  ctx.strokeStyle = isPositive ? '#22c55e' : '#ef4444';
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const stepX = width / (points - 1);
  data.forEach((y, i) => {
    const x = i * stepX;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

export default function AssetCard({ asset }: AssetCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPositive = asset.change24h >= 0;

  // Draw deterministic mini sparkline based on real 24h change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    drawTrendLine(ctx, width, height, asset.change24h);
  }, [asset.change24h]);

  const priceStr = `$${asset.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const changeStr = `${asset.change24h >= 0 ? '+' : ''}${asset.change24h.toFixed(2)}%`;

  return (
    <div className="min-w-[175px] h-[260px] bg-deepSlate rounded-[24px] p-4 flex flex-col justify-between shrink-0 snap-start border border-deepSlate/50 hover:border-primary/30 transition-colors">
      {/* Top row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-darkmode flex items-center justify-center overflow-hidden">
            <Image
              src={asset.logo}
              alt={asset.name}
              width={20}
              height={20}
              className="w-5 h-5"
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">{asset.name}</p>
            <p className="text-[10px] text-charcoalGray">{asset.ticker}</p>
          </div>
        </div>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isPositive ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
          <svg
            className={`w-4 h-4 ${isPositive ? 'text-green-400' : 'text-red-400'} ${isPositive ? '' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </div>
      </div>

      {/* Price */}
      <div className="mt-2">
        <p className="text-xl font-bold text-white">{priceStr}</p>
      </div>

      {/* Sparkline + 24h change */}
      <div className="flex items-end justify-between mt-auto">
        <canvas
          ref={canvasRef}
          width={100}
          height={60}
          className="w-[100px] h-[60px]"
        />
        <span className={`text-xs font-semibold px-2 py-1 rounded-md ${isPositive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          {changeStr}
        </span>
      </div>
    </div>
  );
}
