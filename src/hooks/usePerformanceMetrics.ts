'use client';

import { useMemo } from 'react';
import { UserHistoricalSnapshot } from '@/types/unified';
import type { Prices } from '@/app/dashboard/components/types';

export interface PerformanceMetrics {
  performance24h: number | null;
  performance7d: number | null;
  performance30d: number | null;
}

/**
 * Given a list of snapshots for a user and their *current* total balance,
 * find the closest snapshot at ~24h / ~7d / ~30d ago and compute
 * the percentage change vs today.
 *
 * Returns null for a window when there's no suitable snapshot.
 */
export function usePerformanceMetrics(
  snapshots: UserHistoricalSnapshot[],
  currentTotalBalance: number,
  prices: Prices | null
): PerformanceMetrics {
  return useMemo(() => {
    const now = Date.now();

    const findClosestSnapshot = (targetAgeMs: number): number | null => {
      const targetTime = now - targetAgeMs;
      let closest: UserHistoricalSnapshot | null = null;
      let closestDiff = Infinity;

      for (const s of snapshots) {
        const t = new Date(s.timestamp).getTime();
        const diff = Math.abs(t - targetTime);
        // Only consider snapshots within ±20% of the target window
        const maxAcceptableDiff = targetAgeMs * 0.2;
        if (diff < maxAcceptableDiff && diff < closestDiff) {
          closest = s;
          closestDiff = diff;
        }
      }

      return closest ? closest.totalBalance : null;
    };

    const past24hBalance = findClosestSnapshot(24 * 60 * 60 * 1000);
    const past7dBalance = findClosestSnapshot(7 * 24 * 60 * 60 * 1000);
    const past30dBalance = findClosestSnapshot(30 * 24 * 60 * 60 * 1000);

    const calcPct = (past: number | null): number | null => {
      if (past === null) return null;
      if (past === 0) return currentTotalBalance === 0 ? 0 : null;
      return ((currentTotalBalance - past) / past) * 100;
    };

    const btcPrice = prices?.bitcoin;
    const fallback24h = Number.isFinite(btcPrice?.usd_24h_change ?? NaN) ? btcPrice?.usd_24h_change ?? 0 : 0;
    const fallback7d = Number.isFinite(btcPrice?.usd_7d_change ?? NaN) ? btcPrice?.usd_7d_change ?? 0 : 0;
    const fallback30d = Number.isFinite(btcPrice?.usd_30d_change ?? NaN) ? btcPrice?.usd_30d_change ?? 0 : 0;

    return {
      performance24h: calcPct(past24hBalance) ?? fallback24h,
      performance7d: calcPct(past7dBalance) ?? fallback7d,
      performance30d: calcPct(past30dBalance) ?? fallback30d,
    };
  }, [snapshots, currentTotalBalance, prices]);
}