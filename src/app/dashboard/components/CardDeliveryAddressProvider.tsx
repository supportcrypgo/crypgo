'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { cardDeliveryAddressApi } from '@/data/api';

type CardDeliveryAddressStatus = 'loading' | 'saved' | 'missing' | 'error';

interface CardDeliveryAddressContextValue {
  status: CardDeliveryAddressStatus;
  error: string | null;
  refresh: () => Promise<void>;
  markSaved: () => void;
}

const CardDeliveryAddressContext = createContext<CardDeliveryAddressContextValue | null>(null);

export function CardDeliveryAddressProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<CardDeliveryAddressStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus('loading');
    setError(null);

    try {
      const { has_address: hasAddress } = await cardDeliveryAddressApi.get();
      setStatus(hasAddress ? 'saved' : 'missing');
    } catch (loadError) {
      setStatus('error');
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not check your saved delivery address.',
      );
    }
  }, []);

  const markSaved = useCallback(() => {
    setError(null);
    setStatus('saved');
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ status, error, refresh, markSaved }),
    [status, error, refresh, markSaved],
  );

  return (
    <CardDeliveryAddressContext.Provider value={value}>
      {children}
    </CardDeliveryAddressContext.Provider>
  );
}

export function useCardDeliveryAddress() {
  const context = useContext(CardDeliveryAddressContext);
  if (!context) {
    throw new Error('useCardDeliveryAddress must be used within CardDeliveryAddressProvider.');
  }
  return context;
}
