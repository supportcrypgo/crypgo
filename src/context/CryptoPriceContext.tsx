'use client';

import { createContext, useContext, useEffect, useMemo } from 'react';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { Prices } from '@/app/dashboard/components/types';

interface CryptoPriceContextValue {
  prices: Prices | null;
  isLoading: boolean;
  error: string | null;
}

const CryptoPriceContext = createContext<CryptoPriceContextValue | null>(null);

export function CryptoPriceProvider({ children }: { children: React.ReactNode }) {
  // Use the CoinGecko-backed HTTP route as the single source of truth.
  const http = useCryptoPrices();

  const value = useMemo<CryptoPriceContextValue>(
    () => ({
      prices: http.prices,
      isLoading: http.isLoading,
      error: http.error,
    }),
    [http.prices, http.isLoading, http.error]
  );

  return (
    <CryptoPriceContext.Provider value={value}>
      {children}
    </CryptoPriceContext.Provider>
  );
}

export function useCryptoPricesGlobal(): CryptoPriceContextValue {
  const ctx = useContext(CryptoPriceContext);
  if (!ctx) {
    return {
      prices: null,
      isLoading: false,
      error: null,
    };
  }
  return ctx;
}
