'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { SWAP_ASSETS, type SwapAsset, type SwapQuote, type TradeMode } from '../types';

const LIQUIDITY_FEE_RATE = 0.003; // 0.3%
const DEFAULT_SLIPPAGE = 0.5; // 0.5%

export function useSwapQuote(
  payAsset: SwapAsset | null,
  receiveAsset: SwapAsset | null,
  payAmount: string,
  slippage: number,
  tradeMode: TradeMode
) {
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const calculateQuote = useCallback(async () => {
    if (!payAsset || !receiveAsset) {
      setQuote(null);
      return;
    }

    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      setQuote(null);
      return;
    }

    setIsCalculating(true);

    // Calculate rate: receiveAsset price / payAsset price
    const rate = receiveAsset.price / payAsset.price;

    // Calculate receive amount
    const receiveAmount = amount * rate;

    // Calculate fee (0.3% of pay amount in pay asset)
    const fee = amount * LIQUIDITY_FEE_RATE;

    // Calculate minimum received with slippage
    const minimumReceived = receiveAmount * (1 - slippage / 100);

    // Price impact simulation (0.1% - 2% based on amount vs balance)
    const priceImpact = Math.min(2, (amount / payAsset.balance) * 100);

    const newQuote: SwapQuote = {
      rate,
      fee,
      feeAssetTicker: payAsset.ticker,
      receiveAmount,
      minimumReceived,
      priceImpact,
      route: `${payAsset.ticker} → ${receiveAsset.ticker}`,
    };

    setQuote(newQuote);
    setIsCalculating(false);
  }, [payAsset, receiveAsset, payAmount, slippage, tradeMode]);

  // Debounced calculation
  useEffect(() => {
    calculateQuote();
  }, [calculateQuote]);

  const receiveAmount = useMemo(() => quote?.receiveAmount ?? 0, [quote]);
  const minimumReceived = useMemo(() => quote?.minimumReceived ?? 0, [quote]);
  const isValid = useMemo(() => {
    if (!payAsset || !quote) return false;
    const amount = parseFloat(payAmount);
    return !isNaN(amount) && amount > 0 && amount <= payAsset.balance;
  }, [payAsset, quote, payAmount]);

  return {
    quote,
    isCalculating,
    receiveAmount,
    minimumReceived,
    isValid,
  };
}

export function useAutoPayAmount(
  payAsset: SwapAsset | null,
  receiveAsset: SwapAsset | null,
  receiveAmount: string,
  slippage: number
) {
  const [calculatedPayAmount, setCalculatedPayAmount] = useState<string>('');

  useEffect(() => {
    if (!payAsset || !receiveAsset) {
      setCalculatedPayAmount('');
      return;
    }

    const amount = parseFloat(receiveAmount);
    if (isNaN(amount) || amount <= 0) {
      setCalculatedPayAmount('');
      return;
    }

    // Reverse calculation: pay = receive / rate
    const rate = receiveAsset.price / payAsset.price;
    const payAmount = amount / rate / (1 - slippage / 100) / (1 - LIQUIDITY_FEE_RATE);

    setCalculatedPayAmount(payAmount.toFixed(8));
  }, [payAsset, receiveAsset, receiveAmount, slippage]);

  return calculatedPayAmount;
}
