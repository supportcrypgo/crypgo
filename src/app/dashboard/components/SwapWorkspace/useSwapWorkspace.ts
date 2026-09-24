'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSwapQuote } from './shared/hooks/useSwapQuote';
import { SWAP_ASSETS, type SwapAsset, type TradeMode, type SwapQuote, type QuickSwapResult } from './shared/types';
import { useUnified } from '@/context/UnifiedContext';
import { aggregateWalletAmountsByTicker } from '@/lib/walletBalances';
import { getAssetIconPath } from '@/lib/assetIcons';
import { isTransactionCautionError } from '@/data/api';

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
  const [cautionOpen, setCautionOpen] = useState(false);

  useEffect(() => {
    if (availableAssets.length === 0) return;
    setPayAsset((current) => availableAssets.find((asset) => asset.ticker === current?.ticker) ?? availableAssets[0]);
  }, [availableAssets]);

  useEffect(() => {
    if (!payAsset) return;

    const fallbackReceiveAsset =
      availableAssets.find((asset) => asset.ticker !== payAsset.ticker) ??
      SWAP_ASSETS.find((asset) => asset.ticker !== payAsset.ticker) ??
      payAsset;

    setReceiveAsset((current) => {
      if (current && current.ticker !== payAsset.ticker) {
        return current;
      }
      return fallbackReceiveAsset;
    });
  }, [availableAssets, payAsset]);

  // Quote Calculation Hook
  const { quote, isCalculating, receiveAmount, minimumReceived, isValid } = useSwapQuote(
    payAsset,
    receiveAsset,
    payAmount,
    slippage,
    tradeMode
  );

  // Prevent same asset selection while keeping a valid quote asset in place
  useEffect(() => {
    if (payAsset && receiveAsset && payAsset.id === receiveAsset.id) {
      const replacement = availableAssets.find((asset) => asset.ticker !== payAsset.ticker)
        ?? SWAP_ASSETS.find((asset) => asset.ticker !== payAsset.ticker)
        ?? payAsset;
      setReceiveAsset(replacement);
    }
  }, [availableAssets, payAsset, receiveAsset]);

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
        amount: Number(payAmount),
      });
      const transaction = response?.transaction;
      const executedPayAmount = Number(transaction?.amount ?? payAmount);
      const executedReceiveAmount = Number(transaction?.destination_amount ?? receiveAmount);

      const result: QuickSwapResult = {
        txId: String(transaction?.txid ?? transaction?.id ?? ''),
        payTicker: payAsset.ticker,
        payAmount: executedPayAmount,
        receiveTicker: receiveAsset.ticker,
        receiveAmount: Number(executedReceiveAmount.toFixed(8)),
        rate: `1 ${payAsset.ticker} = ${(Number(transaction?.price_at_time) > 0 ? Number(transaction.destination_amount) / Number(transaction.amount) : quote.rate).toFixed(6)} ${receiveAsset.ticker}`,
        fee: Number(transaction?.fee ?? quote.fee),
        date: transaction?.created_at ?? new Date().toISOString(),
      };

      setSwapResult(result);
    } catch (err) {
      if (isTransactionCautionError(err)) {
        setCautionOpen(true);
        return;
      }
      setError(err instanceof Error ? err.message : 'Swap failed. Please try again.');
    } finally {
      setIsSwapping(false);
    }
  }, [executeSwapTransaction, isValid, payAsset, receiveAsset, quote, payAmount, receiveAmount]);

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
    cautionOpen,
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
    closeCaution: () => setCautionOpen(false),
    handleReset,
  };
}
