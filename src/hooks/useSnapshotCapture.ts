'use client';

import { useEffect, useRef, useState } from 'react';
import { UserHistoricalSnapshot } from '@/types/unified';
import { Prices } from '@/app/dashboard/components/types';
import {
  captureSnapshot,
  shouldCaptureSnapshot,
  getLatestSnapshotForUser,
  getAllSnapshots,
} from '@/data/store';
import { snapshotsApi } from '@/data/api';
import { shouldUseFixtures } from '@/lib/dataSource';

interface UseSnapshotCaptureResult {
  latestSnapshot: UserHistoricalSnapshot | undefined;
  allSnapshots: UserHistoricalSnapshot[];
  captureNow: () => void;
}

function normalizeSnapshotFromApi(payload: any, userId: string): UserHistoricalSnapshot | null {
  if (!payload) return null;

  const timestamp = payload.created_at || payload.timestamp || new Date().toISOString();
  const values = payload.assets && typeof payload.assets === 'object' ? payload.assets : {};
  const assetBreakdown = Object.entries(values).map(([ticker, entry]) => {
    const detail = entry as Record<string, any>;
    const normalizedTicker = String(ticker || '').toUpperCase();
    const validTickers = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'LTC', 'XRP', 'ADA', 'DOT', 'DOGE', 'LINK'] as const;
    const safeTicker = validTickers.includes(normalizedTicker as any) ? (normalizedTicker as typeof validTickers[number]) : 'BTC';

    return {
      ticker: safeTicker,
      quantity: Number(detail?.quantity ?? 0),
      price: Number(detail?.price ?? 0),
      value: Number(detail?.value ?? 0),
    };
  });

  return {
    id: String(payload.id ?? `${userId}-${timestamp}`),
    userId: String(payload.user ?? userId),
    timestamp,
    totalBalance: Number(payload.total_value_usd ?? 0),
    assetBreakdown,
    performance24h: Number.isFinite(Number(payload.performance24h)) ? Number(payload.performance24h) : undefined,
    performance7d: Number.isFinite(Number(payload.performance7d)) ? Number(payload.performance7d) : undefined,
    performance30d: Number.isFinite(Number(payload.performance30d)) ? Number(payload.performance30d) : undefined,
  };
}

export function useSnapshotCapture(
  userId: string | undefined,
  prices: Prices | null
): UseSnapshotCaptureResult {
  const [latestSnapshot, setLatestSnapshot] = useState<UserHistoricalSnapshot | undefined>(
    undefined
  );
  const [allSnapshots, setAllSnapshots] = useState<UserHistoricalSnapshot[]>([]);
  const capturedRef = useRef(false);

  const refresh = async () => {
    if (!userId) return;

    if (shouldUseFixtures()) {
      setLatestSnapshot(getLatestSnapshotForUser(userId));
      setAllSnapshots(getAllSnapshots().filter((s) => s.userId === userId));
      return;
    }

    try {
      const response = await snapshotsApi.list();
      const items = Array.isArray(response?.results) ? response.results : [];
      const normalized = items
        .map((item) => normalizeSnapshotFromApi(item, userId))
        .filter((item): item is UserHistoricalSnapshot => !!item && String(item.userId) === String(userId))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setLatestSnapshot(normalized[0]);
      setAllSnapshots(normalized);
    } catch (error) {
      console.warn('Failed to load wallet snapshots from API, using empty history:', error);
      setLatestSnapshot(undefined);
      setAllSnapshots([]);
    }
  };

  const captureNow = () => {
    if (!userId) return;
    if (!shouldUseFixtures()) return;
    captureSnapshot(userId, prices);
    refresh();
  };

  useEffect(() => {
    if (!userId) return;

    if (shouldUseFixtures()) {
      if (shouldCaptureSnapshot(userId) && !capturedRef.current) {
        capturedRef.current = true;
        captureSnapshot(userId, prices);
      }

      refresh();

      const interval = setInterval(() => {
        if (shouldCaptureSnapshot(userId)) {
          captureSnapshot(userId, prices);
          refresh();
        }
      }, 15 * 60 * 1000);

      return () => clearInterval(interval);
    }

    refresh();
    return undefined;
  }, [userId]);

  return { latestSnapshot, allSnapshots, captureNow };
}
