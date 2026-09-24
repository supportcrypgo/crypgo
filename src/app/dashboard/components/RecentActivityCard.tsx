'use client';

import React from 'react';
import { useUnified } from '@/context/UnifiedContext';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'send' | 'receive' | 'swap';
  asset: string;
  amount: string;
  timestamp: string;
  status: 'completed' | 'pending' | 'failed' | 'cancelled';
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? timestamp
    : date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function mapType(type: string): ActivityItem['type'] {
  if (type === 'withdrawal' || type === 'transfer' || type === 'transfer_out' || type === 'send' || type === 'sell') return 'send';
  if (type === 'swap') return 'swap';
  return 'receive';
}

function getIcon(type: ActivityItem['type']) {
  switch (type) {
    case 'receive':
      return ArrowDownLeft;
    case 'send':
      return ArrowUpRight;
    case 'swap':
      return RefreshCw;
  }
}

function getIconColor(type: ActivityItem['type']) {
  switch (type) {
    case 'receive':
      return 'bg-green-500/20 text-green-400';
    case 'send':
      return 'bg-red-500/20 text-red-400';
    case 'swap':
      return 'bg-primary/20 text-primary';
  }
}

function getTypeLabel(type: ActivityItem['type']) {
  switch (type) {
    case 'receive':
      return 'Receive';
    case 'send':
      return 'Send';
    case 'swap':
      return 'Swap';
  }
}

export default function RecentActivityCard() {
  const { transactions } = useUnified();

  const activityData: ActivityItem[] = transactions.slice(0, 4).map((tx) => {
    const type = mapType(tx.type);
    const isPositive = type === 'receive';
    return {
      id: tx.id,
      type,
      asset: tx.asset,
      amount: `${isPositive ? '+' : '-'}${Math.abs(tx.amount).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${tx.asset}`,
      timestamp: formatTimestamp(tx.createdAt),
      status: tx.status,
    };
  });

  return (
    <div className="bg-deepSlate/50 border border-white/5 rounded-xl p-6">
      <h3 className="text-base font-semibold text-white mb-4">Recent Activity</h3>

      <div className="space-y-3">
        {activityData.length === 0 ? (
          <p className="text-sm text-charcoalGray">No recent activity yet.</p>
        ) : (
          activityData.map((item) => {
            const Icon = getIcon(item.type);
            const iconColor = getIconColor(item.type);
            const isPositive = item.amount.startsWith('+');

            return (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 bg-white/2.5 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${iconColor}`}>
                  <Icon className="w-4 h-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{getTypeLabel(item.type)}</p>
                  <p className="text-xs text-charcoalGray truncate">{item.asset}</p>
                </div>

                <div className="flex-shrink-0 text-right whitespace-nowrap">
                  <p className={`text-sm font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {item.amount}
                  </p>
                  <p className="text-xs text-charcoalGray mt-0.5">{item.timestamp}</p>
                </div>
              </div>
            );
          })
        )}

        <button className="w-full mt-2 h-10 rounded-lg bg-white/5 border border-white/5 text-xs font-medium text-charcoalGray hover:text-white hover:bg-white/10 hover:border-white/10 transition-all flex items-center justify-center gap-1.5">
          View All History
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
