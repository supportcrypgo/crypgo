'use client';

import { useMemo } from 'react';
import { UserHistoricalSnapshot } from '@/types/unified';

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
  currentTotalBalance: number
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
      if (past === null || past === 0) return past === null ? null : 0;
      return ((currentTotalBalance - past) / past) * 100;
    };

    return {
      performance24h: calcPct(past24hBalance),
      performance7d: calcPct(past7dBalance),
      performance30d: calcPct(past30dBalance),
    };
  }, [snapshots, currentTotalBalance]);
}