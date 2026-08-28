'use client';

import { useState, useCallback } from 'react';
import { walletApi } from '@/data/api';
import type { UnifiedWalletAsset } from '@/types/unified';
import type {
  DepositAddressResponse,
  WithdrawResponse,
  TransferResponse,
  BuyResponse,
  SwapResponse
} from '@/data/api';

export interface WalletHook {
  balances: UnifiedWalletAsset[];
  isLoadingBalances: boolean;
  fetchBalances: () => Promise<void>;
  getDepositAddress: (asset: string) => Promise<DepositAddressResponse>;
  withdraw: (data: { asset: string; to_address: string; amount: number; network?: string; memo?: string; fee_level?: string }) => Promise<WithdrawResponse>;
  transfer: (data: { recipient: string; asset: string; amount: number; memo?: string }) => Promise<TransferResponse>;
  buy: (data: { asset: string; amount_usd: number }) => Promise<BuyResponse>;
  swap: (data: { from_asset: string; to_asset: string; amount: number }) => Promise<SwapResponse>;
  getTransactions: (params?: { type?: string; asset?: string; status?: string }) => Promise<any[]>;
}

export function useWallet(): WalletHook {
  const [balances, setBalances] = useState<UnifiedWalletAsset[]>([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  const fetchBalances = useCallback(async () => {
    setIsLoadingBalances(true);
    try {
      const response = await walletApi.getMyWallet();
      setBalances(response);
    } catch (error) {
      console.error('fetchBalances error:', error);
    } finally {
      setIsLoadingBalances(false);
    }
  }, []);

  const getDepositAddress = useCallback(async (asset: string) => {
    return walletApi.getDepositAddress(asset);
  }, []);

  const withdraw = useCallback(async (data: { asset: string; to_address: string; amount: number; network?: string; memo?: string; fee_level?: string }) => {
    return walletApi.withdraw(data);
  }, []);

  const transfer = useCallback(async (data: { recipient: string; asset: string; amount: number; memo?: string }) => {
    return walletApi.transfer(data);
  }, []);

  const buy = useCallback(async (data: { asset: string; amount_usd: number }) => {
    return walletApi.buy(data);
  }, []);

  const swap = useCallback(async (data: { from_asset: string; to_asset: string; amount: number }) => {
    return walletApi.swap(data);
  }, []);

  const getTransactions = useCallback(async (params?: { type?: string; asset?: string; status?: string }) => {
    return walletApi.getTransactions(params);
  }, []);

  return {
    balances,
    isLoadingBalances,
    fetchBalances,
    getDepositAddress,
    withdraw,
    transfer,
    buy,
    swap,
    getTransactions,
  };
}