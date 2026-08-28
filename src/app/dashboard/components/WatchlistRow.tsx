'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Asset } from './types';

interface WatchlistRowProps {
  asset: Asset;
}

const MARKET_CAP_LABELS: Record<string, string> = {
  BTC: '$15.56B',
  BNB: '$1.10B',
  SOL: '$1.30B',
  ETH: '$6.04B',
};

const VOLUME_LABELS: Record<string, string> = {
  BTC: '$2.89B',
  BNB: '$310.4M',
  SOL: '$280.7M',
  ETH: '$1.23B',
};

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format: (value: number) => string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(value);
  const displayValueRef = useRef(value);
  const frameRef = useRef<number | null>(null);
  const initialRenderRef = useRef(true);

  useEffect(() => {
    displayValueRef.current = displayValue;
  }, [displayValue]);

  useEffect(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (initialRenderRef.current || prefersReducedMotion) {
      initialRenderRef.current = false;
      setDisplayValue(value);
      return;
    }

    const startValue = displayValueRef.current;
    const endValue = value;
    const duration = 240;
    const startTime = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = easeOutCubic(progress);
      setDisplayValue(startValue + (endValue - startValue) * eased);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        frameRef.current = null;
        setDisplayValue(endValue);
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [prefersReducedMotion, value]);

  return <span className="tabular-nums">{format(displayValue)}</span>;
}

export default function WatchlistRow({ asset }: WatchlistRowProps) {
  const changeClass = asset.change24h >= 0 ? 'text-green-400' : 'text-red-400';
  const changePrefix = asset.change24h >= 0 ? '+' : '';
  const marketCap = MARKET_CAP_LABELS[asset.ticker] ?? `$${asset.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const volume = VOLUME_LABELS[asset.ticker] ?? '$--';
  const changeValue = asset.change24h;

  return (
    <div className="group block">
      <div className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-white/5 transition-colors border-b border-white/5 min-h-[64px]">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-full bg-deepSlate flex items-center justify-center overflow-hidden flex-shrink-0">
            <img src={asset.logo} alt={asset.ticker} className="w-8 h-8 object-contain" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-white truncate">{asset.ticker}</p>
            <p className="text-xs text-charcoalGray truncate">{asset.name}</p>
          </div>
        </div>

        <div className="hidden md:block w-[180px] shrink-0 text-right">
          <p className="text-sm font-medium text-charcoalGray leading-none">{marketCap}</p>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0 min-w-[120px]">
          <p className="text-sm font-semibold text-white whitespace-nowrap tabular-nums">
            <AnimatedNumber
              value={asset.price}
              format={(value) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
          </p>
          <p className={`text-sm font-semibold ${changeClass} whitespace-nowrap tabular-nums`}>
            <AnimatedNumber
              value={changeValue}
              format={(value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`}
            />
          </p>
        </div>
      </div>
    </div>
  );
}
