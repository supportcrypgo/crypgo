'use client';

import React, { useState, useCallback } from 'react';
import PortfolioRow from './PortfolioRow';
import { Asset } from './types';
import { adminApi, walletApi } from '@/data/api';
import { shouldUseFixtures } from '@/lib/dataSource';

interface PortfolioListProps {
  assets: Asset[];
  isLoading: boolean;
  compact?: boolean;
  editable?: boolean;
  userId?: string;
  onEdit?: () => void;
}

export default function PortfolioList({ assets, isLoading, compact = false, editable = false, userId, onEdit }: PortfolioListProps) {
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const handleQuantityChange = useCallback((assetId: string, value: string) => {
    setEditValues((prev) => ({ ...prev, [assetId]: value }));
  }, []);

  const handleQuantityBlur = useCallback(async (assetId: string, ticker: string) => {
    if (!userId) return;
    const strVal = editValues[assetId];
    if (strVal === undefined) return;
    const numVal = parseFloat(strVal);
    if (isNaN(numVal) || numVal < 0) return;

    try {
      if (userId) {
        // Admin mode: persist to Django for specific user
        await adminApi.updateUserAssetByTicker(userId, ticker, { quantity: numVal });
      } else {
        // User mode: persist to Django for current user
        await walletApi.updateAsset(ticker, { quantity: numVal });
      }
    } catch (error) {
      if (shouldUseFixtures()) {
        console.error('Failed to persist asset update, falling back to seed data:', error);
        const { updateWalletQuantity } = await import('@/data/store');
        updateWalletQuantity(userId, ticker, numVal);
      } else {
        console.error('Failed to persist asset update:', error);
        return;
      }
    }

    onEdit?.();
    setEditValues((prev) => {
      const next = { ...prev };
      delete next[assetId];
      return next;
    });
  }, [editValues, userId, onEdit]);
  return (
    <div className="bg-deepSlate rounded-[24px] p-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-semibold text-white">My Portfolio</h3>
        <span className="text-xs text-charcoalGray">View All</span>
      </div>

      {/* Rows */}
      {isLoading ? (
        <div className="space-y-3 mt-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`flex items-center justify-between ${compact ? 'py-3 px-3' : 'h-[68px] px-1'} animate-pulse border-b border-deepSlate/50 last:border-b-0`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-darkmode" />
                <div className="space-y-1.5">
                  <div className="w-14 h-3 bg-darkmode rounded" />
                  <div className="w-8 h-2 bg-darkmode rounded" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-4 bg-darkmode rounded" />
                <div className="w-14 h-5 bg-darkmode rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-1 flex-1 overflow-y-auto scrollbar-hide">
          {assets
            .sort((a, b) => b.value - a.value)
            .map((asset) => (
              <PortfolioRow
                key={asset.id}
                asset={asset}
                compact={compact}
                editable={editable}
                editValue={editValues[asset.id]}
                onQuantityChange={handleQuantityChange}
                onQuantityBlur={handleQuantityBlur}
              />
            ))
          }
        </div>
      )}
    </div>
  );
}
