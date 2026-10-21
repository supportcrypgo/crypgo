'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { convertUsdAmount, formatCurrencyFromUsd } from '@/lib/displayCurrency.mjs';
import type { DisplayCurrency } from '@/lib/displayCurrencies';
import { profileApi } from '@/data/api';

interface CurrencyContextValue {
  currency: DisplayCurrency;
  rates: Partial<Record<DisplayCurrency, number>>;
  ratesError: string | null;
  ratesLoading: boolean;
  setCurrency: (currency: DisplayCurrency) => Promise<boolean>;
  currencySaveError: string | null;
  refreshRates: () => Promise<void>;
  convertFromUsd: (amount: number) => number | null;
  formatFromUsd: (amount: number, compact?: boolean) => string;
}

const CURRENCY_STORAGE_KEY = 'crypgo-display-currency';
const CURRENCY_MIGRATION_KEY = 'crypgo-display-currency-migrated';
const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function DisplayCurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>('USD');
  const [rates, setRates] = useState<Partial<Record<DisplayCurrency, number>>>({ USD: 1 });
  const [ratesLoading, setRatesLoading] = useState(true);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [currencySaveError, setCurrencySaveError] = useState<string | null>(null);

  const refreshRates = useCallback(async () => {
    setRatesLoading(true);
    setRatesError(null);
    try {
      const response = await fetch('/api/currency/rates');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to load exchange rates.');
      }
      const nextRates = { USD: 1, ...data.rates } as Partial<Record<DisplayCurrency, number>>;
      setRates(nextRates);
    } catch (error) {
      setRatesError(error instanceof Error ? error.message : 'Unable to load exchange rates.');
    } finally {
      setRatesLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshRates();
  }, [refreshRates]);

  useEffect(() => {
    let active = true;

    const loadSavedCurrency = async () => {
      let legacyCurrency: string | null = null;
      let currencyMigrationComplete = false;
      try {
        legacyCurrency = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
        currencyMigrationComplete = window.localStorage.getItem(CURRENCY_MIGRATION_KEY) === 'true';
      } catch (error) {
        console.error('Unable to read the legacy display currency:', error);
      }

      try {
        const user = await profileApi.getMe();
        let savedCurrency = user.displayCurrency || 'USD';

        if (!currencyMigrationComplete) {
          if (legacyCurrency && /^[A-Za-z]{3}$/.test(legacyCurrency)) {
            const updatedUser = await profileApi.updateMe({ displayCurrency: legacyCurrency.toUpperCase() });
            savedCurrency = updatedUser.displayCurrency || legacyCurrency.toUpperCase();
          }
          try {
            window.localStorage.removeItem(CURRENCY_STORAGE_KEY);
            window.localStorage.setItem(CURRENCY_MIGRATION_KEY, 'true');
          } catch (error) {
            console.error('Unable to mark the legacy display currency as migrated:', error);
          }
        }

        if (active && /^[A-Z]{3}$/.test(savedCurrency)) {
          setCurrencyState(savedCurrency);
          setCurrencySaveError(null);
        }
      } catch (error) {
        if (active) {
          setCurrencySaveError(error instanceof Error
            ? `Unable to load your saved currency: ${error.message}`
            : 'Unable to load your saved currency.');
        }
      }
    };

    void loadSavedCurrency();
    return () => {
      active = false;
    };
  }, []);

  const setCurrency = useCallback(async (nextCurrency: DisplayCurrency) => {
    setCurrencySaveError(null);
    try {
      const updatedUser = await profileApi.updateMe({ displayCurrency: nextCurrency });
      const savedCurrency = updatedUser.displayCurrency || nextCurrency;
      setCurrencyState(savedCurrency);
      try {
        window.localStorage.removeItem(CURRENCY_STORAGE_KEY);
        window.localStorage.setItem(CURRENCY_MIGRATION_KEY, 'true');
      } catch (error) {
        console.error('Unable to clear the migrated display currency:', error);
      }
      return true;
    } catch (error) {
      setCurrencySaveError(error instanceof Error
        ? `Unable to save your currency: ${error.message}`
        : 'Unable to save your currency.');
      return false;
    }
  }, []);

  const convertFromUsd = useCallback(
    (amount: number) => convertUsdAmount(amount, rates[currency]),
    [currency, rates],
  );

  const formatFromUsd = useCallback(
    (amount: number, compact = false) =>
      formatCurrencyFromUsd(amount, currency, rates[currency], compact),
    [currency, rates],
  );

  const value = useMemo(
    () => ({
      currency,
      rates,
      ratesError,
      ratesLoading,
      setCurrency,
      currencySaveError,
      refreshRates,
      convertFromUsd,
      formatFromUsd,
    }),
    [currency, rates, ratesError, ratesLoading, setCurrency, currencySaveError, refreshRates, convertFromUsd, formatFromUsd],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useDisplayCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useDisplayCurrency must be used within a DisplayCurrencyProvider');
  }
  return context;
}
