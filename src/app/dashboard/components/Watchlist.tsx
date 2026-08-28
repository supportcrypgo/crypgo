'use client';

import React from 'react';
import { Asset } from './types';
import WatchlistRow from './WatchlistRow';
import { SlidersHorizontal } from 'lucide-react';

interface WatchlistProps {
  assets: Asset[];
  isLoading: boolean;
}

export default function Watchlist({ assets, isLoading }: WatchlistProps) {
  return (
    <section className="mt-10 pt-8 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-xs font-medium text-charcoalGray uppercase tracking-wider lg:text-sm lg:font-semibold">
            WATCHLIST
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-[64px] border-b border-white/5 animate-pulse" />
          ))
        ) : (
          assets.map((asset) => <WatchlistRow key={asset.id} asset={asset} />)
        )}
      </div>
    </section>
  );
}
