'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { SwapQuote } from '@/app/dashboard/components/SwapModal/types';

interface SwapWarningProps {
  quote: SwapQuote | null;
  priceImpact: number;
  slippage: number;
}

export function SwapWarning({ quote, priceImpact, slippage }: SwapWarningProps) {
  // Don't render anything until we have a valid quote
  if (!quote) {
    return null;
  }

  const warnings: Array<{ icon: React.ReactNode; text: string; severity: 'error' | 'warning' }> = [];

  if (priceImpact >= 3) {
    warnings.push({
      icon: <AlertTriangle className="w-4 h-4" />,
      text: `High price impact (${priceImpact.toFixed(1)}%). Consider splitting into smaller trades.`,
      severity: 'error',
    });
  } else if (priceImpact >= 1) {
    warnings.push({
      icon: <AlertTriangle className="w-4 h-4" />,
      text: `Moderate price impact (${priceImpact.toFixed(1)}%). Trade will move the market slightly.`,
      severity: 'warning',
    });
  }

  if (slippage > 2) {
    warnings.push({
      icon: <AlertTriangle className="w-4 h-4" />,
      text: `High slippage tolerance (${slippage}%). You may receive significantly less than quoted.`,
      severity: 'warning',
    });
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-white">Warnings & Notices</h2>

      {warnings.length > 0 ? (
        <div className="space-y-2">
          {warnings.map((warning, index) => (
            <div
              key={index}
              className={`flex items-start gap-2.5 p-3 rounded-lg ${
                warning.severity === 'error'
                  ? 'bg-error/10 border border-error/20'
                  : 'bg-warning/10 border border-warning/20'
              }`}
            >
              <div
                className={`flex-shrink-0 ${
                  warning.severity === 'error' ? 'text-error' : 'text-warning'
                }`}
              >
                {warning.icon}
              </div>
              <p className={`text-xs ${
                warning.severity === 'error' ? 'text-error/90' : 'text-warning/90'
              }`}>
                {warning.text}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2.5 p-3 bg-success/10 border border-success/20 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-success" />
          <p className="text-xs text-success/90">No warnings. Your swap parameters look good.</p>
        </div>
      )}
    </div>
  );
}
