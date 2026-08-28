'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSwapQuote } from './shared/hooks/useSwapQuote';
import { SWAP_ASSETS, type SwapAsset, type TradeMode, type SwapQuote, type QuickSwapResult } from './shared/types';
import { useUnified } from '@/context/UnifiedContext';
import { aggregateWalletAmountsByTicker } from '@/lib/walletBalances';
import { getAssetIconPath } from '@/lib/assetIcons';

const LIQUIDITY_FEE_RATE = 0.003;
const DEFAULT_SLIPPAGE = 0.5;

export function useSwapWorkspace() {
  const { walletAssets, executeSwapTransaction } = useUnified();

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

  // Core State
  const [tradeMode, setTradeMode] = useState<TradeMode>('instant');
  const [payAsset, setPayAsset] = useState<SwapAsset | null>(SWAP_ASSETS[0]);
  const [receiveAsset, setReceiveAsset] = useState<SwapAsset | null>(SWAP_ASSETS[4]);
  const [payAmount, setPayAmount] = useState('');
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapResult, setSwapResult] = useState<QuickSwapResult | null>(null);
  const [error, setError] = useState('');

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

  // Quote Calculation Hook
  const { quote, isCalculating, receiveAmount, minimumReceived, isValid } = useSwapQuote(
    payAsset,
    receiveAsset,
    payAmount,
    slippage,
    tradeMode
  );

  // Prevent same asset selection
  useEffect(() => {
    if (payAsset && receiveAsset && payAsset.id === receiveAsset.id) {
      setReceiveAsset(null);
    }
  }, [payAsset, receiveAsset]);

  // Handle swap direction flip
  const handleSwapDirection = useCallback(() => {
    if (payAsset && receiveAsset && quote) {
      const quoteAmount = quote.receiveAmount * (1 - slippage / 100) / (1 - LIQUIDITY_FEE_RATE);
      setPayAsset(receiveAsset);
      setReceiveAsset(payAsset);
      setPayAmount(quoteAmount.toFixed(8));
    }
  }, [payAsset, receiveAsset, quote, slippage]);

  // Handle pay amount change
  const handlePayAmountChange = useCallback((value: string) => {
    const sanitized = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setPayAmount(sanitized);
    setError('');
  }, []);

  // Quick amount buttons
  const handleQuickAmount = useCallback((percent: number) => {
    if (!payAsset) return;
    const amount = (payAsset.balance * percent) / 100;
    setPayAmount(amount.toFixed(8));
  }, [payAsset]);

  // Max button
  const handleMax = useCallback(() => {
    if (!payAsset) return;
    setPayAmount(payAsset.balance.toFixed(8));
  }, [payAsset]);

  // Handle swap execution
  const handleSwap = useCallback(async () => {
    if (!isValid || !payAsset || !receiveAsset || !quote) return;

    setIsSwapping(true);
    setError('');

    try {
      const response = await executeSwapTransaction({
        from_asset: payAsset.ticker,
        to_asset: receiveAsset.ticker,
        amount: parseFloat(payAmount),
      });

      const result: QuickSwapResult = {
        txId: response?.transaction?.txid || response?.transaction?.id || '0x' + Math.random().toString(16).substr(2, 64),
        payTicker: payAsset.ticker,
        payAmount: parseFloat(payAmount),
        receiveTicker: receiveAsset.ticker,
        receiveAmount: quote.receiveAmount,
        rate: `1 ${payAsset.ticker} = ${quote.rate.toFixed(6)} ${receiveAsset.ticker}`,
        fee: quote.fee,
        date: response?.transaction?.created_at || new Date().toISOString(),
      };

      setSwapResult(result);
    } catch (err) {
      setError('Swap failed. Please try again.');
    } finally {
      setIsSwapping(false);
    }
  }, [isValid, payAsset, receiveAsset, quote, payAmount, minimumReceived]);

  // Handle success close
  const handleSuccessClose = useCallback(() => {
    setSwapResult(null);
    setPayAmount('');
  }, []);

  // Handle retry
  const handleRetry = useCallback(() => {
    setError('');
    setIsSwapping(false);
  }, []);

  // Reset all state
  const handleReset = useCallback(() => {
    setPayAsset(availableAssets[0] ?? SWAP_ASSETS[0]);
    setReceiveAsset(availableAssets.find((asset) => asset.ticker !== (availableAssets[0]?.ticker ?? '')) ?? availableAssets[1] ?? SWAP_ASSETS[4]);
    setPayAmount('');
    setSlippage(DEFAULT_SLIPPAGE);
    setTradeMode('instant');
    setSwapResult(null);
    setError('');
  }, [availableAssets]);

  return {
    // State
    tradeMode,
    setTradeMode,
    payAsset,
    setPayAsset,
    receiveAsset,
    setReceiveAsset,
    payAmount,
    setPayAmount: handlePayAmountChange,
    slippage,
    setSlippage,
    isSwapping,
    swapResult,
    error,
    isCalculating,
    quote,
    receiveAmount,
    minimumReceived,
    isValid,
    availableAssets,
    // Actions
    handleSwapDirection,
    handleQuickAmount,
    handleMax,
    handleSwap,
    handleSuccessClose,
    handleRetry,
    handleReset,
  };
}
