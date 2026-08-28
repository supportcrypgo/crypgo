'use client';

import React, { useState } from 'react';
import { SendAssetInfo, NetworkOption } from '../types';

interface SendSummaryProps {
  asset: SendAssetInfo;
  network: NetworkOption;
  recipient: string;
  amount: number;
  networkFee: number; // Now a number (calculated as amount * feePercentage)
  totalAmount: number;
  estimatedArrival: string;
  balance: string;
}

export default function SendSummary({
  asset,
  network,
  recipient,
  amount,
  networkFee,
  totalAmount,
  estimatedArrival,
  balance,
}: SendSummaryProps) {
  const [copied, setCopied] = useState(false);

  // Truncate recipient address for display
  const displayAddress = recipient.length > 24
    ? `${recipient.substring(0, 12)}...${recipient.substring(recipient.length - 8)}`
    : recipient;

  const handleCopy = async () => {
    if (!recipient) return;
    try {
      await navigator.clipboard.writeText(recipient);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      setCopied(false);
    }
  };

  const copyIcon = copied ? (
    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ) : (
    <svg className="w-4 h-4 text-charcoalGray hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );

  // Format fee for display with 1% label
  const formatFee = (fee: number, ticker: string): string => {
    if (fee === 0) return `~0 ${ticker} (1%)`;
    return `${fee.toFixed(8)} ${ticker} (1%)`;
  };

  // Mock USD conversion for display (same logic as AmountField)
  const getUsdValue = (assetTicker: string, assetAmount: number): number => {
    const rates: Record<string, number> = {
      'BTC': 67500,
      'ETH': 3450,
      'SOL': 148,
      'BNB': 580,
      'USDT': 1,
      'XRP': 0.62,
      'ADA': 0.48,
      'DOT': 7.25,
      'DOGE': 0.10,
      'LINK': 14.50,
    };
    return (rates[assetTicker] || 1) * assetAmount;
  };

  return (
    <div className="space-y-4 animate-in fade-in-50 slide-in-from-right-2 duration-200">
      <div>
        <h3 className="text-[11px] font-medium text-charcoalGray uppercase tracking-[0.08em] mb-4">
          Transaction Summary
        </h3>

        <div className="lg:bg-white/5 lg:border lg:border-white/5 lg:rounded-xl lg:overflow-hidden">
          <div className="space-y-0 lg:p-2">
            {/* Asset + Network (Consolidated) */}
            <div className="px-4 py-3.5 flex items-center justify-between gap-3">
              <p className="text-xs text-charcoalGray flex-shrink-0">Asset</p>
              <div className="flex items-center gap-2.5 min-w-0 justify-end">
                <img src={asset.logo} alt={asset.ticker} className="w-6 h-6 rounded-full flex-shrink-0" />
                <div className="min-w-0 text-right flex items-baseline justify-end gap-1">
                  <p className="text-sm font-medium text-white truncate">{asset.name}</p>
                </div>
              </div>
            </div>

            {/* Recipient */}
            <div className="px-4 py-3.5 flex items-center justify-between gap-3">
              <p className="text-xs text-charcoalGray flex-shrink-0">Recipient</p>
              <div className="flex items-center gap-2 min-w-0 justify-end">
                <p
                  className="text-sm font-mono text-white truncate"
                  title={recipient}
                >
                  {displayAddress || '—'}
                </p>
                {recipient && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="p-1.5 rounded-md hover:bg-white/10 transition-colors flex-shrink-0"
                    aria-label="Copy recipient address"
                    title="Copy address"
                  >
                    {copyIcon}
                  </button>
                )}
              </div>
            </div>

            {/* Amount */}
            <div className="px-4 py-3.5 flex items-center justify-between">
              <p className="text-xs text-charcoalGray">Amount</p>
              <div className="text-right">
                <p className="text-sm font-semibold text-white">
                  {amount ? `${amount.toLocaleString()} ${asset.ticker}` : '—'}
                </p>
                {amount > 0 && (
                  <p className="text-xs text-charcoalGray">≈ ${getUsdValue(asset.ticker, amount).toFixed(2)} USD</p>
                )}
              </div>
            </div>

            {/* Network Fee */}
            <div className="px-4 py-3.5 flex items-center justify-between">
              <p className="text-xs text-charcoalGray">Network Fee</p>
              <div className="text-right">
                <p className="text-sm font-medium text-primary">{formatFee(networkFee, asset.ticker)}</p>
              </div>
            </div>

            {/* Divider before total */}
            <div className="border-t border-white/10 px-4 pb-3.5" />

            {/* Total Amount */}
            <div className="px-4 py-3.5 flex items-center justify-between">
              <p className="text-xs text-charcoalGray">Total Amount</p>
              {totalAmount > 0 && (
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">
                    {totalAmount.toLocaleString()} {asset.ticker}
                  </p>
                  <p className="text-xs text-charcoalGray">≈ ${getUsdValue(asset.ticker, totalAmount).toFixed(2)} USD</p>
                </div>
              )}
            </div>

            {/* Estimated Arrival */}
            <div className="px-4 py-3.5 flex items-center justify-between">
              <p className="text-xs text-charcoalGray">Est. Arrival</p>
              <p className="text-sm font-medium text-emerald-400">{estimatedArrival}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
