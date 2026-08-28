'use client';

import React from 'react';
import { useTransactions } from '../context/TransactionContext';
import { TransactionTabType } from '../types';

const tabs: { id: TransactionTabType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'buy', label: 'Buy' },
  { id: 'sell', label: 'Sell' },
  { id: 'deposit', label: 'Deposit' },
  { id: 'withdrawal', label: 'Withdrawal' },
  { id: 'send', label: 'Send' },
  { id: 'receive', label: 'Receive' },
];

interface Props {
  isDesktop?: boolean;
}

export default function MobileTransactionTabs({ isDesktop }: Props) {
  const { activeTab, setActiveTab } = useTransactions();
  const tabsRowClass = isDesktop
    ? 'flex bg-darkcard border border-deepSlate rounded-xl p-1 w-full overflow-x-auto'
    : 'flex bg-darkcard rounded-xl p-1 w-full overflow-x-auto scrollbar-hide';

  return (
    <div className={`flex gap-2 ${isDesktop ? '' : ''}`}>
      <div className={tabsRowClass}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-primary text-darkmode shadow-sm'
                  : 'text-charcoalGray hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
