'use client';

import React from 'react';
import { useTransactions } from '../context/TransactionContext';
import {
  DollarSign,
  ArrowUpRight,
  CheckCircle,
  TrendingUp,
  PieChart,
} from 'lucide-react';

export default function DesktopTransactionSummary() {
  const { summaryMetrics, volumeByType, loading } = useTransactions();

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-4 mt-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-darkcard border border-deepSlate rounded-xl p-5 animate-pulse">
            <div className="h-3 w-20 bg-deepSlate rounded mb-3" />
            <div className="h-6 w-28 bg-deepSlate rounded" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: 'Total Volume',
      value: `$${summaryMetrics.totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <DollarSign className="w-5 h-5 text-green-400" />,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    {
      label: 'Transactions',
      value: summaryMetrics.totalTransactions.toString(),
      icon: <ArrowUpRight className="w-5 h-5 text-blue-400" />,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Completion Rate',
      value: `${summaryMetrics.completionRate}%`,
      icon: <CheckCircle className="w-5 h-5 text-emerald-400" />,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Avg. Trade Value',
      value: `$${(summaryMetrics.totalVolume / (summaryMetrics.totalTransactions || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <TrendingUp className="w-5 h-5 text-purple-400" />,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="mt-6 space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-darkcard border border-deepSlate rounded-xl p-5 flex flex-col gap-3"
          >
            <div className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}>
                {card.icon}
              </div>
              <span className="text-xs text-charcoalGray">{card.label}</span>
            </div>
            <span className={`text-xl font-bold ${card.color}`}>{card.value}</span>
          </div>
        ))}
      </div>

      {/* Volume by type breakdown */}
      <div className="bg-darkcard border border-deepSlate rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-white">Volume by Type</h3>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {volumeByType.map((v) => (
            <div key={v.type} className="flex flex-col gap-1">
              <span className="text-xs text-charcoalGray capitalize">{v.type}</span>
              <span className="text-sm font-semibold text-white">
                ${v.volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <div className="w-full bg-deepSlate rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${
                    v.type === 'buy' ? 'bg-green-400' :
                    v.type === 'sell' ? 'bg-red-400' :
                    v.type === 'deposit' ? 'bg-blue-400' : 'bg-orange-400'
                  }`}
                  style={{ width: `${v.percentage}%` }}
                />
              </div>
              <span className="text-xs text-charcoalGray">{v.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}