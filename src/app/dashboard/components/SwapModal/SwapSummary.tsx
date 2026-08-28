'use client';

import React from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import type { SwapQuote, SwapAsset } from './types';

// ─── Local Asset Icon Map ───
const LOCAL_ASSET_ICONS: Record<string, string> = {
  BTC: '/images/icons/icon-bitcoin.svg',
  ETH: '/images/icons/icon-ethereum.svg',
  SOL: '/images/icons/icon-solana.svg',
  LTC: '/images/icons/icon-litecoin.svg',
  DOGE: '/images/icons/icon-dogecoin.svg',
};

function getLocalIconPath(ticker: string): string {
  return LOCAL_ASSET_ICONS[ticker] || '/images/icons/icon-bitcoin-circle.svg';
}

function handleImageError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  ticker: string
) {
  const target = e.target as HTMLImageElement;
  const localIcon = getLocalIconPath(ticker);
  if (target.src !== localIcon) {
    target.src = localIcon;
    target.onerror = null;
  }
}

interface SwapSummaryProps {
  quote: SwapQuote | null;
  payAsset: SwapAsset | null;
  receiveAsset: SwapAsset | null;
  minimumReceived: number;
}

export default function SwapSummary({ quote, payAsset, receiveAsset, minimumReceived }: SwapSummaryProps) {
  if (!quote || !payAsset || !receiveAsset) {
    return (
      <div className="p-4 rounded-xl bg-white/5 border border-white/5">
        <p className="text-xs text-charcoalGray text-center py-4">Select assets to see swap summary</p>
      </div>
    );
  }

  const formatAmount = (value: number, ticker: string) => {
    return `${value.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${ticker}`;
  };

  const rateDisplay = `${quote.rate.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${receiveAsset.ticker}`;

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-4">
      {/* Route */}
      <div className="space-y-1">
        <p className="text-xs text-charcoalGray">Route</p>
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <span className="flex items-center gap-1.5">
            <img src={payAsset.logo} alt={payAsset.name} className="w-4 h-4 rounded-full"
              onError={(e) => handleImageError(e, payAsset.ticker)} />
            {payAsset.ticker}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-charcoalGray" />
          <span className="flex items-center gap-1.5">
            <img src={receiveAsset.logo} alt={receiveAsset.name} className="w-4 h-4 rounded-full"
              onError={(e) => handleImageError(e, receiveAsset.ticker)} />
            {receiveAsset.ticker}
          </span>
        </div>
        <p className="text-[10px] text-charcoalGray">Best route via Crypgo Liquidity</p>
      </div>

      <div className="border-t border-white/5 pt-4 space-y-3">
        {/* Minimum Received */}
        <div>
          <p className="text-xs text-charcoalGray mb-1">Minimum Received</p>
          <p className="text-lg font-semibold text-white">{formatAmount(minimumReceived, receiveAsset.ticker)}</p>
          <p className="text-xs text-charcoalGray">(at {quote.priceImpact.toFixed(2)}% slippage tolerance)</p>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-xs text-warning">
            You will receive at least <strong>{formatAmount(minimumReceived, receiveAsset.ticker)}</strong> or the transaction will revert.
          </p>
        </div>
      </div>
    </div>
  );
}