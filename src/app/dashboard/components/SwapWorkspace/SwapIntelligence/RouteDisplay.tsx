'use client';

import React from 'react';
import { GitBranch, Coins } from 'lucide-react';
import type { SwapQuote } from '@/app/dashboard/components/SwapModal/types';

interface RouteDisplayProps {
  quote: SwapQuote | null;
}

export function RouteDisplay({ quote }: RouteDisplayProps) {
  const route = quote?.route || null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-white">Routing Path</h2>
      </div>

      {route ? (
        <>
          <div className="flex items-center justify-center gap-2 py-4">
            {route.split(' → ').map((asset, index, arr) => (
              <React.Fragment key={index}>
                <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg">
                  <Coins className="w-3.5 h-3.5 text-primary" />
                  <span className="text-sm font-medium text-white">{asset}</span>
                </div>
                {index < arr.length - 1 && (
                  <span className="text-xs text-charcoalGray">→</span>
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="pt-2 border-t border-white/5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-charcoalGray">Hops</span>
              <span className="text-white font-medium">{route.split(' → ').length - 1}</span>
            </div>
          </div>
        </>
      ) : (
        <p className="text-xs text-charcoalGray py-2">
          Select assets to see the optimal routing path for your swap.
        </p>
      )}
    </div>
  );
}
