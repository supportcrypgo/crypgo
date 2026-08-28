'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Loader2, CheckCircle, RefreshCw, X } from 'lucide-react';
import {
  SWAP_ASSETS,
  type SwapAsset,
  type TradeMode,
  type QuickSwapResult,
} from './types';
import { useSwapQuote } from './hooks/useSwapQuote';
import SwapHeader from './SwapHeader';
import SwapDirectionButton from './SwapDirectionButton';
import AssetSelector from './AssetSelector';
import SwapCalculation from './SwapCalculation';
import SwapSummary from './SwapSummary';
import { useUnified } from '@/context/UnifiedContext';
import { aggregateWalletAmountsByTicker } from '@/lib/walletBalances';
import { getAssetIconPath } from '@/lib/assetIcons';

const LIQUIDITY_FEE_RATE = 0.003;
const DEFAULT_SLIPPAGE = 0.5;

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SwapModal({ isOpen, onClose }: SwapModalProps) {
  const { walletAssets } = useUnified();

  // Build asset list with live wallet balances (available/spendable quantity)
  const availableAssets = useMemo<SwapAsset[]>(() => {
    if (walletAssets.length === 0) return SWAP_ASSETS;

    const balances = aggregateWalletAmountsByTicker(walletAssets, 'availableQuantity');
    const uniqueAssets = walletAssets.reduce<SwapAsset[]>((acc, asset) => {
      if (acc.some((item) => item.ticker === asset.ticker)) return acc;
      acc.push({
        id: asset.id,
        name: asset.name,
        ticker: asset.ticker,
        logo: getAssetIconPath(asset.ticker, asset.logo),
        price: asset.price,
        balance: balances[asset.ticker] ?? 0,
      });
      return acc;
    }, []);

    return uniqueAssets.length > 0 ? uniqueAssets : SWAP_ASSETS;
  }, [walletAssets]);

  // State
  const [tradeMode, setTradeMode] = useState<TradeMode>('instant');
  const [payAsset, setPayAsset] = useState<SwapAsset | null>(SWAP_ASSETS[0]);
  const [receiveAsset, setReceiveAsset] = useState<SwapAsset | null>(SWAP_ASSETS[5]);
  const [payAmount, setPayAmount] = useState('');
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapResult, setSwapResult] = useState<QuickSwapResult | null>(null);
  const [error, setError] = useState('');

  // Keep pay/receive assets in sync with live balances
  useEffect(() => {
    if (availableAssets.length === 0) return;
    setPayAsset((current) => availableAssets.find((asset) => asset.ticker === current?.ticker) ?? availableAssets[0]);
  }, [availableAssets]);

  useEffect(() => {
    if (availableAssets.length === 0) return;
    setReceiveAsset((current) => {
      const currentMatch = availableAssets.find((asset) => asset.ticker === current?.ticker);
      if (currentMatch && currentMatch.ticker !== payAsset?.ticker) {
        return currentMatch;
      }
      return availableAssets.find((asset) => asset.ticker !== payAsset?.ticker) ?? availableAssets[1] ?? availableAssets[0];
    });
  }, [availableAssets, payAsset?.ticker]);

  // Hook for quote calculation
  const { quote, isCalculating, receiveAmount, minimumReceived, isValid } = useSwapQuote(
    payAsset,
    receiveAsset,
    payAmount,
    slippage,
    tradeMode
  );

  // Auto-fill payAsset if empty and user picks receiveAsset first
  useEffect(() => {
    if (payAsset && receiveAsset && payAsset.id === receiveAsset.id) {
      // If they somehow became the same, clear receive
      setReceiveAsset(null);
    }
  }, [payAsset, receiveAsset]);

  // Handle swap direction button
  const handleSwapDirection = useCallback(() => {
    if (payAsset && receiveAsset) {
      const quoteAmount = quote ? (quote.receiveAmount * (1 - slippage / 100)) / (1 - LIQUIDITY_FEE_RATE) : null;
      setPayAsset(receiveAsset);
      setReceiveAsset(payAsset);
      setPayAmount(quoteAmount !== null ? quoteAmount.toFixed(8) : '');
    }
  }, [payAsset, receiveAsset, quote, slippage]);

  // Handle pay amount change
  const handlePayAmountChange = (value: string) => {
    // Only allow numbers, one decimal point
    const sanitized = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setPayAmount(sanitized);
    setError('');
  };

  // Quick amount buttons
  const quickAmounts = [25, 50, 75, 100];
  const handleQuickAmount = (percent: number) => {
    if (!payAsset) return;
    const amount = (payAsset.balance * percent) / 100;
    setPayAmount(amount.toFixed(8));
  };

  // Max button
  const handleMax = () => {
    if (!payAsset) return;
    setPayAmount(payAsset.balance.toFixed(8));
  };

  // Handle swap execution
  const handleSwap = async () => {
    if (!isValid || !payAsset || !receiveAsset || !quote) return;

    setIsSwapping(true);
    setError('');

    try {
      // Simulate transaction
      await new Promise(resolve => setTimeout(resolve, 2000));

      const result: QuickSwapResult = {
        txId: '0x' + Math.random().toString(16).substr(2, 64),
        payTicker: payAsset.ticker,
        payAmount: parseFloat(payAmount),
        receiveTicker: receiveAsset.ticker,
        receiveAmount: minimumReceived,
        rate: `1 ${payAsset.ticker} = ${quote.rate.toFixed(6)} ${receiveAsset.ticker}`,
        fee: quote.fee,
        date: new Date().toISOString(),
      };

      setSwapResult(result);
    } catch (err) {
      setError('Swap failed. Please try again.');
    } finally {
      setIsSwapping(false);
    }
  };

  // Handle success - close modal
  const handleSuccessClose = () => {
    setSwapResult(null);
    setPayAmount('');
    onClose();
  };

  // Handle retry after error
  const handleRetry = () => {
    setError('');
    setIsSwapping(false);
  };

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const formatAmount = (value: number, ticker: string) => {
    return `${value.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${ticker}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-50 duration-200">
      {/* Mobile-first: full screen on mobile, centered on desktop */}
      <div className="relative w-full max-w-[420px] max-h-[95vh] bg-[#1e293b] border border-primary/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 fade-in-50 duration-200">
        {/* Header with Tabs */}
        <SwapHeader
          tradeMode={tradeMode}
          onTradeModeChange={setTradeMode}
          onClose={onClose}
        />

        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-auto p-4 pb-20 space-y-4">
          {/* Pay Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-charcoalGray">You Pay</span>
              {payAsset && (
                <span className="text-xs text-charcoalGray">
                  Available: {payAsset.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })} {payAsset.ticker}
                </span>
              )}
            </div>

            <AssetSelector
              selectedAsset={payAsset}
              onSelect={setPayAsset}
              placeholder="Select asset to pay"
              excludeAsset={receiveAsset}
              disabled={isCalculating || isSwapping}
            />

            {/* Amount Input */}
            <div className="relative">
              <input
                type="text"
                value={payAmount}
                onChange={(e) => handlePayAmountChange(e.target.value)}
                placeholder="0.00000000"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-base font-medium focus:outline-none focus:border-primary/50 transition-colors"
                disabled={isCalculating || isSwapping || !payAsset}
              />
              {isCalculating && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                </div>
              )}
            </div>

            {/* Quick Amount Buttons */}
            {payAsset && (
              <div className="flex gap-2 flex-wrap">
                {quickAmounts.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handleQuickAmount(pct)}
                    disabled={isCalculating || isSwapping}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-charcoalGray hover:text-white font-medium transition-colors disabled:opacity-50"
                  >
                    {pct}%
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleMax}
                  disabled={isCalculating || isSwapping || !payAmount}
                  className="px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-xs text-primary font-medium transition-colors disabled:opacity-50"
                >
                  Max
                </button>
              </div>
            )}
          </div>

          {/* Swap Direction Button */}
          <div className="flex justify-center my-2">
            <SwapDirectionButton
              onClick={handleSwapDirection}
              disabled={isCalculating || isSwapping || !payAsset || !receiveAsset}
            />
          </div>

          {/* Receive Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-charcoalGray">You Receive</span>
              {receiveAsset && (
                <span className="text-xs text-charcoalGray">Estimated</span>
              )}
            </div>

            <AssetSelector
              selectedAsset={receiveAsset}
              onSelect={setReceiveAsset}
              placeholder="Select asset to receive"
              excludeAsset={payAsset}
              disabled={isCalculating || isSwapping}
            />

            {/* Estimated Amount Display */}
            <div className="relative">
              <div className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5">
                {isCalculating ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    <span className="text-base font-medium text-charcoalGray">Calculating...</span>
                  </div>
                ) : receiveAsset && quote ? (
                  <>
                    <p className="text-2xl font-semibold text-white">
                      {formatAmount(quote.receiveAmount, receiveAsset.ticker)}
                    </p>
                    <p className="text-xs text-charcoalGray mt-1">
                      ≈ ${(quote.receiveAmount * receiveAsset.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </>
                ) : (
                  <p className="text-base font-medium text-charcoalGray">—</p>
                )}
              </div>
            </div>

            {/* Calculations */}
            <SwapCalculation
              quote={quote}
              payAsset={payAsset}
              receiveAsset={receiveAsset}
              slippage={slippage}
              onSlippageChange={setSlippage}
              isCalculating={isCalculating}
            />
          </div>
        </div>

        {/* Summary Panel - Fixed at bottom on mobile, right column on desktop */}
        <div className="hidden lg:block absolute right-4 top-[140px] bottom-24 w-72 overflow-auto">
          <SwapSummary
            quote={quote}
            payAsset={payAsset}
            receiveAsset={receiveAsset}
            minimumReceived={minimumReceived}
          />
        </div>

        {/* Mobile Summary - Fixed at bottom */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 mx-4 mb-4 max-w-[420px]">
          <SwapSummary
            quote={quote}
            payAsset={payAsset}
            receiveAsset={receiveAsset}
            minimumReceived={minimumReceived}
          />
        </div>

        {/* Bottom Action Bar */}
        <div className="p-4 border-t border-white/5 bg-white/5 flex flex-col gap-3">
          {swapResult ? (
            // Success State
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="bg-green-500/20 rounded-full p-4">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white">Swap Complete!</h3>
              <div className="text-sm text-gray-400 space-y-1 text-center">
                <p>Swapped <span className="text-white font-medium">{formatAmount(swapResult.payAmount, swapResult.payTicker)}</span></p>
                <p>Received <span className="text-white font-medium">{formatAmount(swapResult.receiveAmount, swapResult.receiveTicker)}</span></p>
                <p className="text-xs">Rate: {swapResult.rate}</p>
                <p className="text-xs">Fee: {formatAmount(swapResult.fee, swapResult.payTicker)}</p>
              </div>
              <button
                onClick={handleSuccessClose}
                className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
              >
                Done
              </button>
            </div>
          ) : error ? (
            // Error State
            <div className="flex flex-col gap-3">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
                <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
              <button
                onClick={handleRetry}
                className="w-full bg-white/5 hover:bg-white/10 text-charcoalGray hover:text-white font-medium py-3 px-4 rounded-xl transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : isSwapping ? (
            // Swapping State
            <div className="flex flex-col items-center gap-4 py-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-sm text-white">Executing swap...</p>
              <p className="text-xs text-charcoalGray">Please wait while we process your transaction</p>
            </div>
          ) : (
            // Default Swap Button
            <button
              onClick={handleSwap}
              disabled={!isValid || isCalculating || !payAsset || !receiveAsset || !payAmount}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3.5 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              <span>Swap</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
