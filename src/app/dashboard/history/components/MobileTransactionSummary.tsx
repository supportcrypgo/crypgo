'use client';

import React from 'react';
import { useTransactions } from '../context/TransactionContext';
import { DollarSign, ArrowUpRight, CheckCircle, TrendingUp } from 'lucide-react';

export default function MobileTransactionSummary() {
  const { summaryMetrics, volumeByType, loading } = useTransactions();

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="hidden md:flex flex-col bg-darkcard border border-deepSlate rounded-xl p-4 animate-pulse">
          <div className="h-3 w-20 bg-deepSlate rounded mb-3" />
          <div className="h-5 w-24 bg-deepSlate rounded" />
        </div>
        <div className="hidden md:flex flex-col bg-darkcard border border-deepSlate rounded-xl p-4 animate-pulse">
          <div className="h-3 w-20 bg-deepSlate rounded mb-3" />
          <div className="h-5 w-24 bg-deepSlate rounded" />
        </div>
      </div>
    );
  }

  const topMetrics = [
    {
      label: 'Total Volume',
      value: `$${summaryMetrics.totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <DollarSign className="w-4 h-4 text-green-400" />,
      color: 'text-green-400',
    },
    {
      label: 'Transactions',
      value: summaryMetrics.totalTransactions.toString(),
      icon: <ArrowUpRight className="w-4 h-4 text-blue-400" />,
      color: 'text-blue-400',
    },
    {
      label: 'Completion Rate',
      value: `${summaryMetrics.completionRate}%`,
      icon: <CheckCircle className="w-4 h-4 text-emerald-400" />,
      color: 'text-emerald-400',
    },
    {
      label: 'Avg. Trade Value',
      value: `$${(summaryMetrics.totalVolume / (summaryMetrics.totalTransactions || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <TrendingUp className="w-4 h-4 text-purple-400" />,
      color: 'text-purple-400',
    },
  ];

  const donutColors = [
    'bg-green-400',
    'bg-red-400',
    'bg-blue-400',
    'bg-orange-400',
  ];

  const donutLabels = ['Buy', 'Sell', 'Deposit', 'Withdrawal'];

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Card 1: Key Metrics */}
      <div className="hidden md:flex flex-col bg-darkcard border border-deepSlate rounded-xl p-4 gap-3">
        {topMetrics.map((m) => (
          <div key={m.label} className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {m.icon}
              <span className="text-xs text-charcoalGray">{m.label}</span>
            </div>
            <span className={`text-sm font-bold ${m.color}`}>{m.value}</span>
          </div>
        ))}
      </div>

      {/* Card 2: Volume Breakdown (simple stacked bar chart) */}
      <div className="hidden md:flex flex-col bg-darkcard border border-deepSlate rounded-xl p-4 gap-3">
        <span className="text-xs text-charcoalGray font-medium">Volume Breakdown</span>
        <div className="flex gap-1 h-2">
          {volumeByType.map((v, i) => (
            <div
              key={v.type}
              className={`${donutColors[i]} rounded-full`}
              style={{ width: `${v.percentage}%` }}
            />
          ))}
        </div>
        <div className="space-y-1.5 mt-1">
          {volumeByType.map((v, i) => (
            <div key={v.type} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${donutColors[i]}`} />
                <span className="text-xs text-charcoalGray capitalize">{donutLabels[i]}</span>
              </div>
              <span className="text-xs text-white font-medium">
                ${v.volume.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
