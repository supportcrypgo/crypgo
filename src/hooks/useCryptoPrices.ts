'use client';

import { useState, useEffect, useCallback } from 'react';
import { Prices } from '@/app/dashboard/components/types';

const CACHE_KEY = 'crypto_prices_cache';
const CACHE_DURATION = 120000; // 120 seconds
const MAX_INITIAL_ATTEMPTS = 3;

interface CacheEntry {
  data: Prices;
  timestamp: number;
}

function hasUsablePriceSet(data: Partial<Prices> | null | undefined): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const requiredKeys = [
    'bitcoin',
    'ethereum',
    'binancecoin',
    'solana',
    'litecoin',
    'tether',
    'dogecoin',
    'cardano',
    'polkadot',
    'chainlink',
    'ripple',
  ] as const;

  let positivePrices = 0;

  for (const key of requiredKeys) {
    const entry = data[key];
    const usd = Number(entry?.usd ?? 0);

    if (Number.isFinite(usd) && usd > 0) {
      positivePrices += 1;
    }
  }

  return positivePrices >= 3 && (Number(data.bitcoin?.usd ?? 0) > 0 || Number(data.ethereum?.usd ?? 0) > 0 || Number(data.solana?.usd ?? 0) > 0);
}

function readCachedPrices(): Prices | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const cached = window.localStorage.getItem(CACHE_KEY);
  if (!cached) {
    return null;
  }

  try {
    const parsed = JSON.parse(cached) as Partial<CacheEntry>;
    const entry = parsed?.data;
    const timestamp = Number(parsed?.timestamp ?? 0);

    if (!entry || !Number.isFinite(timestamp) || Date.now() - timestamp > CACHE_DURATION) {
      window.localStorage.removeItem(CACHE_KEY);
      return null;
    }

    if (!hasUsablePriceSet(entry)) {
      window.localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return entry as Prices;
  } catch {
    window.localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

export function useCryptoPrices(enabled = true) {
  const [prices, setPrices] = useState<Prices | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = useCallback(async () => {
    if (!enabled) {
      setIsLoading(true);
      return;
    }

    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_INITIAL_ATTEMPTS; attempt += 1) {
      try {
        const cachedPrices = readCachedPrices();
        if (cachedPrices) {
          setPrices(cachedPrices);
          setError(null);
          setIsLoading(false);
          return;
        }

        const response = await fetch('/api/crypto/prices', { cache: 'no-store' });

        if (!response.ok) {
          throw new Error(`Failed to fetch prices (${response.status})`);
        }

        const data: Prices = await response.json();

        if (!hasUsablePriceSet(data)) {
          throw new Error('Invalid or zero-valued price response');
        }

        setPrices(data);
        setError(null);
        window.localStorage.setItem(CACHE_KEY, JSON.stringify({
          data,
          timestamp: Date.now(),
        }));
        setIsLoading(false);
        return;
      } catch (err) {
        lastError = err;
        if (attempt < MAX_INITIAL_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 500));
        }
      }
    }

    try {
      console.error('Error fetching prices after retries:', lastError);
      setError((currentPrices) => currentPrices ? null : 'Failed to load prices. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchPrices();

    const interval = setInterval(fetchPrices, 120000);
    return () => clearInterval(interval);
  }, [fetchPrices, enabled]);

  return { prices, isLoading, error, refetch: fetchPrices };
}