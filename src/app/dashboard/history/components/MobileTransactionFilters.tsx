'use client';

import React from 'react';
import { useTransactions } from '../context/TransactionContext';
import { RotateCcw } from 'lucide-react';

const transactionTypeOptions = [
  { value: '', label: 'All Types' },
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdrawal', label: 'Withdrawal' },
];

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface Props {
  isDesktop?: boolean;
}

export default function MobileTransactionFilters({ isDesktop }: Props) {
  const { filters, setFilters, assets } = useTransactions();
  const fieldClass =
    'w-full bg-darkmode/70 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/60 transition-colors';
  const selectClass =
    'flex-1 min-w-[80px] bg-darkmode/70 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/60 transition-colors appearance-none';

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleReset = () => {
    setFilters({ dateFrom: '', dateTo: '', asset: '', type: '', status: '' });
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${isDesktop ? '' : ''}`}>
      {/* Date From */}
      <div className="relative flex-1 min-w-[120px]">
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
          className={fieldClass}
          style={{ colorScheme: 'dark' }}
        />
      </div>

      {/* Date To */}
      <div className="relative flex-1 min-w-[120px]">
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => handleFilterChange('dateTo', e.target.value)}
          className={fieldClass}
          style={{ colorScheme: 'dark' }}
        />
      </div>

      {/* Asset Select */}
      <select
        value={filters.asset}
        onChange={(e) => handleFilterChange('asset', e.target.value)}
        className={selectClass}
        style={{ colorScheme: 'dark' }}
      >
        <option value="">All Assets</option>
        {assets.map((asset) => (
          <option key={asset} value={asset}>{asset}</option>
        ))}
      </select>

      {/* Type Filter (mobile only) */}
      {!isDesktop && (
        <select
          value={filters.type}
          onChange={(e) => handleFilterChange('type', e.target.value)}
          className={selectClass}
          style={{ colorScheme: 'dark' }}
        >
          {transactionTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {/* Status Filter (desktop only) */}
      {isDesktop && (
        <select
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          className={selectClass}
          style={{ colorScheme: 'dark' }}
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {/* Reset */}
      <button
        onClick={handleReset}
        className="flex items-center gap-1 px-3 py-2 bg-darkmode/70 border border-white/10 rounded-lg text-sm text-charcoalGray hover:text-white hover:border-primary/60 transition-colors"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Reset</span>
      </button>
    </div>
  );
}
