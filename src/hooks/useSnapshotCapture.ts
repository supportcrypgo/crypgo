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
import { shouldUseFixtures } from '@/lib/dataSource';

interface UseSnapshotCaptureResult {
  latestSnapshot: UserHistoricalSnapshot | undefined;
  allSnapshots: UserHistoricalSnapshot[];
  captureNow: () => void;
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

  const refresh = () => {
    if (!userId) return;
    setLatestSnapshot(getLatestSnapshotForUser(userId));
    setAllSnapshots(getAllSnapshots().filter((s) => s.userId === userId));
  };

  const captureNow = () => {
    if (!userId) return;
    if (!shouldUseFixtures()) return;
    captureSnapshot(userId, prices);
    refresh();
  };

  useEffect(() => {
    if (!userId) return;

    if (!shouldUseFixtures()) {
      refresh();
      return;
    }

    // Capture immediately if due
    if (shouldCaptureSnapshot(userId) && !capturedRef.current) {
      capturedRef.current = true;
      captureSnapshot(userId, prices);
    }

    refresh();

    // Check every 15 minutes if a capture is due
    const interval = setInterval(() => {
      if (shouldCaptureSnapshot(userId)) {
        captureSnapshot(userId, prices);
        refresh();
      }
    }, 15 * 60 * 1000); // 15 min check interval
    // ─── Note: capture threshold is still 2 hours via shouldCaptureSnapshot ───
    // ─── This interval is just a checker, not the capture cadence ───

    return () => clearInterval(interval);
  }, [userId]);

  return { latestSnapshot, allSnapshots, captureNow };
}
