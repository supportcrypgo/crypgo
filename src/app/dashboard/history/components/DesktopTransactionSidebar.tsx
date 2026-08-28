'use client';

import React from 'react';
import { useTransactions } from '../context/TransactionContext';
import {
  DollarSign,
  TrendingUp,
  Clock,
  HelpCircle,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowUpFromLine,
  ArrowDownToLine,
  CheckCircle,
  PieChart,
} from 'lucide-react';
import { useUnified } from '@/context/UnifiedContext';

function getTypeIcon(type: string) {
  switch (type) {
    case 'buy': return <ArrowDownLeft className="w-3.5 h-3.5 text-green-400" />;
    case 'sell': return <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />;
    case 'deposit': return <ArrowDownToLine className="w-3.5 h-3.5 text-blue-400" />;
    case 'withdrawal': return <ArrowUpFromLine className="w-3.5 h-3.5 text-orange-400" />;
    default: return null;
  }
}

const volumeColors: Record<string, string> = {
  buy: 'bg-green-400',
  sell: 'bg-red-400',
  deposit: 'bg-blue-400',
  withdrawal: 'bg-orange-400',
};

export default function DesktopTransactionSidebar() {
  const { filteredTransactions, summaryMetrics, volumeByType } = useTransactions();
  const { walletSummary, walletAssets } = useUnified();

  // Most recent 4 transactions for the "Recent Activity" panel
  const recentActivity = filteredTransactions.slice(0, 4);
  const topAssets = [...walletAssets].sort((a, b) => b.value - a.value).slice(0, 3);

  return (
    <div className="space-y-5 sticky top-6">
      {/* Wallet Summary */}
      <div className="bg-deepSlate/30 border border-deepSlate rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">My Wallet</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-charcoalGray">Total Balance</span>
            <span className="text-sm font-bold text-white">
              ${walletSummary.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          {topAssets.length === 0 ? (
            <p className="text-xs text-charcoalGray">No wallet assets available.</p>
          ) : (
            topAssets.map((asset) => (
              <div key={asset.id} className="flex items-center justify-between">
                <span className="text-sm text-charcoalGray">{asset.ticker}</span>
                <span className="text-sm text-white">
                  {asset.quantity.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} {asset.ticker}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Wallet actions */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-deepSlate">
          <button className="flex-1 px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors">
            Deposit
          </button>
          <button className="flex-1 px-3 py-2 rounded-xl bg-deepSlate/50 text-charcoalGray text-xs font-semibold hover:text-white hover:bg-deepSlate transition-colors">
            Withdraw
          </button>
          <button className="flex-1 px-3 py-2 rounded-xl bg-deepSlate/50 text-charcoalGray text-xs font-semibold hover:text-white hover:bg-deepSlate transition-colors">
            Transfer
          </button>
        </div>
      </div>

      {/* Quick Stats (summary metrics) */}
      <div className="bg-deepSlate/30 border border-deepSlate rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Quick Stats</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-xs text-charcoalGray">Total Volume</span>
            </div>
            <span className="text-xs font-semibold text-white">
              ${summaryMetrics.totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-charcoalGray">Transactions</span>
            </div>
            <span className="text-xs font-semibold text-white">{summaryMetrics.totalTransactions}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-charcoalGray">Completion Rate</span>
            </div>
            <span className="text-xs font-semibold text-emerald-400">{summaryMetrics.completionRate}%</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-charcoalGray">Avg. Trade</span>
            </div>
            <span className="text-xs font-semibold text-white">
              ${(summaryMetrics.totalVolume / (summaryMetrics.totalTransactions || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Volume Breakdown (moved from DesktopTransactionSummary) */}
      <div className="bg-deepSlate/30 border border-deepSlate rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <PieChart className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-white">Volume by Type</h3>
        </div>
        <div className="space-y-3">
          {volumeByType.map((v) => (
            <div key={v.type} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-charcoalGray capitalize">{v.type}</span>
                <span className="text-xs font-semibold text-white">
                  ${v.volume.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 })}
                </span>
              </div>
              <div className="w-full bg-deepSlate rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${volumeColors[v.type] || 'bg-gray-400'}`}
                  style={{ width: `${v.percentage}%` }}
                />
              </div>
              <span className="text-xs text-charcoalGray">{v.percentage}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-deepSlate/30 border border-deepSlate rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Recent Activity</h3>
        {recentActivity.length === 0 ? (
          <p className="text-xs text-charcoalGray">No recent activity</p>
        ) : (
          <div className="space-y-2.5">
            {recentActivity.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    tx.type === 'buy' ? 'bg-green-400' :
                    tx.type === 'sell' ? 'bg-red-400' :
                    tx.type === 'deposit' ? 'bg-blue-400' : 'bg-orange-400'
                  }`} />
                  <span className="text-xs text-charcoalGray">
                    {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)} {tx.asset}
                  </span>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-medium ${
                    tx.amountPositive ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {tx.amountPositive ? '+' : '-'}{tx.amount.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Support Card */}
      <div className="bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Need Help?</h3>
            <p className="text-xs text-charcoalGray">24/7 Support</p>
          </div>
        </div>
        <p className="text-xs text-charcoalGray mb-3 leading-relaxed">
          Our support team is available around the clock to assist you with any questions about your transactions.
        </p>
        <button className="w-full px-4 py-2.5 rounded-xl bg-primary text-darkmode text-xs font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/20">
          Contact Support
        </button>
      </div>
    </div>
  );
}
