'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useUnified } from '@/context/UnifiedContext';
import type { UnifiedTransaction } from '@/types/unified';
import type { 
  Transaction, 
  TransactionContextType, 
  TransactionFilterState, 
  TransactionTabType, 
  SummaryMetrics,
  VolumeByType 
} from '../types';

const TransactionContext = createContext<TransactionContextType | undefined>(undefined);

// Helper: Convert UnifiedTransaction to Transaction
function convertTransaction(tx: UnifiedTransaction, index: number): Transaction {
  // Map unified transaction type to history transaction type
  let type = tx.type;
  if (type === 'transfer') {
    type = 'send'; // Map transfer to send
  }
  
  // Determine if positive (received/bought) based on transaction type
  const amountPositive = ['buy', 'deposit', 'receive'].includes(type);
  
  return {
    id: tx.id,
    dateTime: tx.createdAt,
    type: type as any,
    asset: tx.asset,
    amountPositive: amountPositive,
    amount: tx.amount,
    price: tx.price,
    totalValue: tx.totalValue,
    status: tx.status,
    txId: tx.id,
    counterpartyType: tx.counterpartyType === 'external' ? 'send' : 'receive',
    walletAddress: tx.walletAddress,
    fee: tx.fee,
    feeAsset: tx.feeAsset,
    network: tx.network,
  };
}

// Helper: Calculate summary metrics
function calculateSummaryMetrics(transactions: Transaction[]): SummaryMetrics {
  const totalVolume = transactions.reduce((sum, tx) => sum + tx.totalValue, 0);
  const completed = transactions.filter(tx => tx.status === 'completed').length;
  return {
    totalVolume: Math.round(totalVolume * 100) / 100,
    totalTransactions: transactions.length,
    completionRate: transactions.length > 0 ? Math.round((completed / transactions.length) * 100) : 0,
  };
}

// Helper: Calculate volume by type
function calculateVolumeByType(transactions: Transaction[]): VolumeByType[] {
  const typeMap: Record<string, number> = {};
  const types: string[] = ['buy', 'sell', 'deposit', 'withdrawal', 'send', 'receive'];
  
  // Initialize all types
  types.forEach(t => { typeMap[t] = 0; });
  
  // Sum by type
  transactions.forEach(tx => {
    if (!typeMap[tx.type]) typeMap[tx.type] = 0;
    typeMap[tx.type] += tx.totalValue;
  });
  
  const total = Object.values(typeMap).reduce((a, b) => a + b, 0);
  
  return types
    .filter(t => typeMap[t] > 0)
    .map(type => ({
      type: type as any,
      volume: Math.round(typeMap[type] * 100) / 100,
      percentage: total > 0 ? Math.round((typeMap[type] / total) * 100) : 0,
    }))
    .sort((a, b) => b.volume - a.volume);
}

// Helper: Apply filters
function applyFilters(
  transactions: Transaction[], 
  filters: TransactionFilterState, 
  activeTab: TransactionTabType
): Transaction[] {
  let result = transactions;

  // Apply tab filter
  if (activeTab !== 'all') {
    result = result.filter(tx => tx.type === activeTab);
  }

  // Apply asset filter
  if (filters.asset && filters.asset !== '') {
    result = result.filter(tx => tx.asset.toUpperCase() === filters.asset.toUpperCase());
  }

  // Apply type filter
  if (filters.type && filters.type !== '') {
    result = result.filter(tx => tx.type === filters.type);
  }

  // Apply status filter
  if (filters.status && filters.status !== '') {
    result = result.filter(tx => tx.status === filters.status);
  }

  // Apply date range
  if (filters.dateFrom) {
    const dateFrom = new Date(filters.dateFrom);
    result = result.filter(tx => new Date(tx.dateTime) >= dateFrom);
  }
  if (filters.dateTo) {
    const dateTo = new Date(filters.dateTo);
    dateTo.setHours(23, 59, 59, 999);
    result = result.filter(tx => new Date(tx.dateTime) <= dateTo);
  }

  return result.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
}

export function TransactionProvider({ children }: { children: React.ReactNode }) {
  const { transactions: unifiedTransactions, isLoading } = useUnified();
  const [filters, setFilters] = useState<TransactionFilterState>({
    dateFrom: '',
    dateTo: '',
    asset: '',
    type: '',
    status: '',
  });
  const [activeTab, setActiveTab] = useState<TransactionTabType>('all');

  // Convert UnifiedTransactions to Transaction format
  const transactions = useMemo(() => 
    unifiedTransactions.map((tx, idx) => convertTransaction(tx, idx)),
    [unifiedTransactions]
  );

  // Get unique assets
  const assets = useMemo(() => 
    Array.from(new Set(transactions.map(tx => tx.asset))).sort(),
    [transactions]
  );

  // Helper to get transaction by ID
  const getTransactionById = useCallback((id: string) => 
    transactions.find(tx => tx.id === id),
    [transactions]
  );

  // Apply filters
  const filteredTransactions = useMemo(() => 
    applyFilters(transactions, filters, activeTab),
    [transactions, filters, activeTab]
  );

  // Calculate metrics
  const summaryMetrics = useMemo(() => 
    calculateSummaryMetrics(filteredTransactions),
    [filteredTransactions]
  );

  const volumeByType = useMemo(() => 
    calculateVolumeByType(filteredTransactions),
    [filteredTransactions]
  );

  const value: TransactionContextType = {
    transactions,
    filteredTransactions,
    filters,
    setFilters,
    activeTab,
    setActiveTab,
    loading: isLoading,
    summaryMetrics,
    volumeByType,
    assets,
    getTransactionById,
  };

  return (
    <TransactionContext.Provider value={value}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions(): TransactionContextType {
  const ctx = useContext(TransactionContext);
  if (!ctx) {
    return {
      transactions: [],
      filteredTransactions: [],
      filters: {
        dateFrom: '',
        dateTo: '',
        asset: '',
        type: '',
        status: '',
      },
      setFilters: () => {},
      activeTab: 'all',
      setActiveTab: () => {},
      loading: false,
      summaryMetrics: { totalVolume: 0, totalTransactions: 0, completionRate: 0 },
      volumeByType: [],
      assets: [],
      getTransactionById: () => undefined,
    };
  }
  return ctx;
}
