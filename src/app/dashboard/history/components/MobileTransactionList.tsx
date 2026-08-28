'use client';

import React from 'react';
import Image from 'next/image';
import { useTransactions } from '../context/TransactionContext';
import { Transaction } from '../types';
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowUpFromLine,
  ArrowDownToLine,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
} from 'lucide-react';

const COINGECKO_IMAGES: Record<string, string> = {
  BTC: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
  ETH: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
  SOL: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
  LTC: 'https://assets.coingecko.com/coins/images/2/large/litecoin.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
  BNB: 'https://assets.coingecko.com/coins/images/825/large/binance-coin-logo.png',
  XRP: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png',
  ADA: 'https://assets.coingecko.com/coins/images/975/large/cardano.png',
  DOT: 'https://assets.coingecko.com/coins/images/12171/large/polkadot.png',
  DOGE: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png',
  LINK: 'https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png',
};

function getTypeIcon(type: string) {
  switch (type) {
    case 'buy':
      return <ArrowDownLeft className="w-4 h-4 text-green-400" />;
    case 'sell':
      return <ArrowUpRight className="w-4 h-4 text-red-400" />;
    case 'deposit':
      return <ArrowDownToLine className="w-4 h-4 text-blue-400" />;
    case 'withdrawal':
      return <ArrowUpFromLine className="w-4 h-4 text-orange-400" />;
    case 'send':
      return <ArrowUpRight className="w-4 h-4 text-red-400" />;
    case 'receive':
      return <ArrowDownLeft className="w-4 h-4 text-green-400" />;
    default:
      return null;
  }
}

function getTypeBg(type: string) {
  switch (type) {
    case 'buy':
    case 'receive':
      return 'bg-green-500/10';
    case 'sell':
    case 'send':
      return 'bg-red-500/10';
    case 'deposit':
      return 'bg-blue-500/10';
    case 'withdrawal':
      return 'bg-orange-500/10';
    default:
      return 'bg-deepSlate';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
    case 'pending':
      return <Clock className="w-3.5 h-3.5 text-yellow-400" />;
    case 'failed':
      return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    case 'cancelled':
      return <AlertCircle className="w-3.5 h-3.5 text-gray-400" />;
    default:
      return null;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function CounterpartyDisplay({ tx }: { tx: Transaction }) {
  if (tx.counterpartyType === 'send') {
    return (
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
          <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] text-charcoalGray">To: Wallet</span>
          <span className="text-[11px] font-mono text-white truncate max-w-[120px]">
            {tx.walletAddress ? `${tx.walletAddress.slice(0, 6)}...${tx.walletAddress.slice(-4)}` : 'Unknown'}
          </span>
        </div>
      </div>
    );
  }

  if (tx.counterpartyType === 'receive') {
    return (
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
          <ArrowDownLeft className="w-3.5 h-3.5 text-green-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] text-charcoalGray">From: Wallet</span>
          <span className="text-[11px] font-mono text-white truncate max-w-[120px]">
            {tx.walletAddress ? `${tx.walletAddress.slice(0, 6)}...${tx.walletAddress.slice(-4)}` : 'Unknown'}
          </span>
        </div>
      </div>
    );
  }

  return null;
}

function TransactionCard({ tx }: { tx: Transaction }) {
  return (
    <div className="bg-darkcard border border-deepSlate rounded-xl p-4 space-y-3 hover:border-primary/30 transition-colors">
      {/* Top row: type badge + status + date */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${getTypeBg(tx.type)} flex items-center justify-center`}>
            {getTypeIcon(tx.type)}
          </div>
          <div>
            <span className="text-sm font-semibold text-white capitalize">{tx.type}</span>
            <span className="text-xs text-charcoalGray ml-2 inline-flex items-center gap-1">
              <Image
                src={COINGECKO_IMAGES[tx.asset] || ''}
                alt={tx.asset}
                width={12}
                height={12}
                className="rounded-full"
                unoptimized
              />
              {tx.asset}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {getStatusIcon(tx.status)}
          <span className={`text-xs capitalize ${
            tx.status === 'completed' ? 'text-emerald-400' :
            tx.status === 'pending' ? 'text-yellow-400' :
            tx.status === 'failed' ? 'text-red-400' : 'text-gray-400'
          }`}>
            {tx.status}
          </span>
        </div>
      </div>

      {/* Amount row */}
      <div className="flex items-center justify-between">
        <div>
          <span className={`text-lg font-bold ${tx.amountPositive ? 'text-green-400' : 'text-red-400'}`}>
            {tx.amountPositive ? '+' : '-'}{tx.amount.toLocaleString()} {tx.asset}
          </span>
        </div>
        <span className="text-sm text-charcoalGray">
          ${tx.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* Bottom row: counterparty identity + date */}
      <div className="flex items-center justify-between pt-1 border-t border-deepSlate/50">
        <div className="flex items-center gap-2.5">
          <CounterpartyDisplay tx={tx} />
          <span className="text-[10px] text-charcoalGray hidden sm:inline">{formatDate(tx.dateTime)}</span>
          <span className="text-[10px] text-charcoalGray hidden sm:inline">{formatTime(tx.dateTime)}</span>
        </div>
      </div>
    </div>
  );
}

export default function MobileTransactionList() {
  const { filteredTransactions, loading } = useTransactions();

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-darkcard border border-deepSlate rounded-xl p-4 animate-pulse space-y-3">
            <div className="flex justify-between">
              <div className="h-4 w-24 bg-deepSlate rounded" />
              <div className="h-4 w-16 bg-deepSlate rounded" />
            </div>
            <div className="h-6 w-32 bg-deepSlate rounded" />
            <div className="h-3 w-48 bg-deepSlate rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (filteredTransactions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto rounded-full bg-deepSlate flex items-center justify-center mb-4">
          <Clock className="w-8 h-8 text-charcoalGray" />
        </div>
        <p className="text-charcoalGray text-sm">No transactions found</p>
        <p className="text-charcoalGray text-xs mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filteredTransactions.map((tx) => (
        <TransactionCard key={tx.id} tx={tx} />
      ))}
    </div>
  );
}
