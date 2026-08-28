'use client';

import { useState, useEffect, useCallback } from 'react';
import { Prices } from '@/app/dashboard/components/types';

const CACHE_KEY = 'crypto_prices_cache';
const CACHE_DURATION = 60000; // 60 seconds

interface CacheEntry {
  data: Prices;
  timestamp: number;
}

export function useCryptoPrices() {
  const [prices, setPrices] = useState<Prices | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = useCallback(async () => {
    try {
      // Check cache first
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed: CacheEntry = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_DURATION) {
          setPrices(parsed.data);
          setIsLoading(false);
          return;
        }
      }

      const response = await fetch('/api/crypto/prices');
      
      if (!response.ok) {
        throw new Error('Failed to fetch prices');
      }

      const data: Prices = await response.json();
      
      // Validate data has required fields for all supported coin tickers
      if (
        !data.bitcoin ||
        !data.ethereum ||
        !data.binancecoin ||
        !data.solana ||
        !data.litecoin ||
        !data.tether ||
        !data.dogecoin ||
        !data.cardano ||
        !data.polkadot ||
        !data.chainlink ||
        !data.ripple
      ) {
        throw new Error('Invalid response format');
      }

      setPrices(data);
      setError(null);

      // Cache the data
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    } catch (err) {
      console.error('Error fetching prices:', err);
      setError('Failed to load prices. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  return { prices, isLoading, error, refetch: fetchPrices };
}