'use client';

import { useState, useEffect, useCallback } from 'react';

// Local type to avoid importing server route module into client bundle
export interface CoinMarketData {
  id: string;
  name: string;
  symbol: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
  sparkline_in_7d: { price: number[] } | null;
}

const CACHE_KEY = 'crypto_market_cache';
const CACHE_DURATION = 60000; // 60 seconds

interface CacheEntry {
  data: CoinMarketData[];
  timestamp: number;
}

export function useCryptoMarket() {
  const [marketData, setMarketData] = useState<CoinMarketData[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const byId = useCallback((id: string): CoinMarketData | undefined => {
    return marketData?.find((c) => c.id === id);
  }, [marketData]);

  const bySymbol = useCallback((symbol: string): CoinMarketData | undefined => {
    return marketData?.find((c) => c.symbol.toLowerCase() === symbol.toLowerCase());
  }, [marketData]);

  const fetchMarketData = useCallback(async () => {
    try {
      // Check cache first
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed: CacheEntry = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_DURATION) {
          setMarketData(parsed.data);
          setIsLoading(false);
          return;
        }
      }

      const response = await fetch('/api/crypto/market');

      if (!response.ok) {
        throw new Error('Failed to fetch market data');
      }

      const data: CoinMarketData[] = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Invalid response format');
      }

      setMarketData(data);
      setError(null);

      // Cache the data
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    } catch (err) {
      console.error('Error fetching market data:', err);
      setError('Failed to load market data. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarketData();

    // Refresh every 60 seconds
    const interval = setInterval(fetchMarketData, 60000);
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  return { marketData, isLoading, error, refetch: fetchMarketData, byId, bySymbol };
}