'use client';

import React from 'react';
import { Download } from 'lucide-react';

export default function DesktopTransactionHeader() {
  const handleExport = () => {
    // CSV export — will use filtered data from context in production
    alert('Export CSV — integration with backend pending.');
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-white">Transaction History</h1>
        <p className="text-sm text-charcoalGray mt-1">
          Track all your trades, deposits, and withdrawals
        </p>
      </div>
      <button
        onClick={handleExport}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-darkmode rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
      >
        <Download className="w-4 h-4" />
        Export CSV
      </button>
    </div>
  );
}
