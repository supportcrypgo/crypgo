'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { TransactionProvider } from './context/TransactionContext';

import MobileHeader from '../components/MobileHeader';
import DesktopSidebar, { SIDEBAR_OFFSET_CLASS } from '../components/DesktopSidebar';
import DesktopHeader from '../components/DesktopHeader';
import BottomNav from '../components/BottomNav';

// Mobile components
import MobileTransactionTabs from './components/MobileTransactionTabs';
import MobileTransactionSummary from './components/MobileTransactionSummary';
import MobileTransactionFilters from './components/MobileTransactionFilters';
import MobileTransactionList from './components/MobileTransactionList';

// Desktop components
import DesktopTransactionHeader from './components/DesktopTransactionHeader';
import DesktopTransactionTable from './components/DesktopTransactionTable';
import DesktopTransactionSidebar from './components/DesktopTransactionSidebar';

export default function TransactionHistoryPage() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [menuOpen, setMenuOpen] = useState(false);

  const pageContent = isDesktop ? (
    // Desktop view
    <div className="min-h-screen bg-darkmode text-white">
      {/* Sidebar */}
      <DesktopSidebar />

      {/* Main workspace (offset by sidebar width) */}
      <div className={SIDEBAR_OFFSET_CLASS}>
        {/* Desktop Header */}
        <DesktopHeader title="Transaction History" />

        {/* Content area with main table + right sidebar */}
        <main className="px-7 pt-6 pb-10">
          {/* Page title row + action buttons */}
          <DesktopTransactionHeader />

          {/* Tabs (desktop styled) — appears before filters */}
          <div className="mt-6">
            <MobileTransactionTabs isDesktop />
          </div>

          {/* Filter controls row */}
          <div className="mt-6">
            <div className="flex items-center gap-4 bg-darkmode/70 border border-white/10 rounded-2xl p-4">
              <MobileTransactionFilters isDesktop />
            </div>
          </div>

          {/* Main content: table + right sidebar */}
          <div className="flex gap-6 mt-6">
            {/* Transaction table (left) */}
            <div className="flex-1 min-w-0">
              {/* Summary moved to right sidebar; inline summary removed */}
              <DesktopTransactionTable />
            </div>

            {/* Right sidebar panels */}
            <div className="w-[300px] shrink-0 hidden xl:block">
              <DesktopTransactionSidebar />
            </div>
          </div>
        </main>
      </div>
    </div>
  ) : (
    // Mobile view
    <div className="min-h-screen bg-darkmode text-white">
      {/* Header */}
      <MobileHeader onMenuClick={() => setMenuOpen(!menuOpen)} />

      {/* Drawer overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="px-4 pt-0 pb-[88px] space-y-5">

        {/* Summary metrics cards */}
        <MobileTransactionSummary />

        {/* All / Buy / Sell / Deposit / Withdrawal tabs */}
        <MobileTransactionTabs />

        {/* Filter controls row */}
        <MobileTransactionFilters />

        {/* Transaction cards stack */}
        <MobileTransactionList />
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab="history" />
    </div>
  );

  return <TransactionProvider>{pageContent}</TransactionProvider>;
}
