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
  Copy,
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
    case 'buy': return <ArrowDownLeft className="w-4 h-4 text-green-400" />;
    case 'sell': return <ArrowUpRight className="w-4 h-4 text-red-400" />;
    case 'deposit': return <ArrowDownToLine className="w-4 h-4 text-blue-400" />;
    case 'withdrawal': return <ArrowUpFromLine className="w-4 h-4 text-orange-400" />;
    case 'send': return <ArrowUpRight className="w-4 h-4 text-red-400" />;
    case 'receive': return <ArrowDownLeft className="w-4 h-4 text-green-400" />;
    default: return null;
  }
}

function getTypeBg(type: string) {
  switch (type) {
    case 'buy': case 'receive': return 'bg-green-500/10';
    case 'sell': case 'send': return 'bg-red-500/10';
    case 'deposit': return 'bg-blue-500/10';
    case 'withdrawal': return 'bg-orange-500/10';
    default: return 'bg-deepSlate';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed': return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
    case 'pending': return <Clock className="w-3.5 h-3.5 text-yellow-400" />;
    case 'failed': return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    case 'cancelled': return <AlertCircle className="w-3.5 h-3.5 text-gray-400" />;
    default: return null;
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

function truncateTxId(txId: string): string {
  if (txId.length <= 20) return txId;
  return txId.slice(0, 10) + '...' + txId.slice(-6);
}

function CounterpartyCell({ tx }: { tx: Transaction }) {
  if (tx.counterpartyType === 'send') {
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
          <ArrowUpRight className="w-4 h-4 text-red-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] text-charcoalGray">To: Wallet</span>
          <span className="text-xs font-mono text-white flex items-center gap-1">
            {tx.walletAddress ? `${tx.walletAddress.slice(0, 6)}...${tx.walletAddress.slice(-4)}` : 'Unknown'}
            {tx.walletAddress && <Copy className="w-3 h-3 text-charcoalGray cursor-pointer hover:text-white" />}
          </span>
        </div>
      </div>
    );
  }

  if (tx.counterpartyType === 'receive') {
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
          <ArrowDownLeft className="w-4 h-4 text-green-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] text-charcoalGray">From: Wallet</span>
          <span className="text-xs font-mono text-white flex items-center gap-1">
            {tx.walletAddress ? `${tx.walletAddress.slice(0, 6)}...${tx.walletAddress.slice(-4)}` : 'Unknown'}
            {tx.walletAddress && <Copy className="w-3 h-3 text-charcoalGray cursor-pointer hover:text-white" />}
          </span>
        </div>
      </div>
    );
  }

  return null;
}

export default function DesktopTransactionTable() {
  const { filteredTransactions, loading } = useTransactions();

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-14 bg-deepSlate/30 rounded-xl" />
        ))}
      </div>
    );
  }

  if (filteredTransactions.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-deepSlate/50 flex items-center justify-center">
          <Clock className="w-8 h-8 text-charcoalGray" />
        </div>
        <h3 className="text-base font-semibold text-white mb-1">No transactions found</h3>
        <p className="text-sm text-charcoalGray">Try adjusting your filters to see more results.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        {/* Table Header */}
        <thead>
          <tr className="border-b border-deepSlate">
            <th className="text-left text-xs font-medium text-charcoalGray uppercase tracking-wider pb-3 pr-3">Date & Time</th>
            <th className="text-left text-xs font-medium text-charcoalGray uppercase tracking-wider pb-3 px-3">Type</th>
            <th className="text-left text-xs font-medium text-charcoalGray uppercase tracking-wider pb-3 px-3">Asset</th>
            <th className="text-right text-xs font-medium text-charcoalGray uppercase tracking-wider pb-3 px-3">Amount</th>
            <th className="text-left text-xs font-medium text-charcoalGray uppercase tracking-wider pb-3 px-3">Counterparty</th>
            <th className="text-left text-xs font-medium text-charcoalGray uppercase tracking-wider pb-3 px-3">Status</th>
            <th className="text-left text-xs font-medium text-charcoalGray uppercase tracking-wider pb-3 px-3">Tx ID</th>
            <th className="text-right text-xs font-medium text-charcoalGray uppercase tracking-wider pb-3 pl-3">Action</th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody>
          {filteredTransactions.map((tx: Transaction) => {
            return (
              <tr
                key={tx.id}
                className="border-b border-deepSlate/50 hover:bg-deepSlate/20 transition-colors"
              >
                {/* Date & Time */}
                <td className="py-4 pr-3">
                  <div className="flex flex-col">
                    <span className="text-sm text-charcoalGray whitespace-nowrap">{formatDate(tx.dateTime)}</span>
                    <span className="text-xs text-charcoalGray/60 whitespace-nowrap">{formatTime(tx.dateTime)}</span>
                  </div>
                </td>

                {/* Type */}
                <td className="py-4 px-3">
                  <div className={`w-8 h-8 rounded-lg ${getTypeBg(tx.type)} flex items-center justify-center`}>
                    {getTypeIcon(tx.type)}
                  </div>
                </td>

                {/* Asset */}
                <td className="py-4 px-3">
                  <span className="text-sm font-semibold text-white inline-flex items-center gap-1.5">
                    <Image
                      src={COINGECKO_IMAGES[tx.asset] || ''}
                      alt={tx.asset}
                      width={16}
                      height={16}
                      className="rounded-full"
                      unoptimized
                    />
                    {tx.asset}
                  </span>
                </td>

                {/* Amount */}
                <td className="py-4 px-3 text-right">
                  <span className={`text-sm font-semibold ${tx.amountPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.amountPositive ? '+' : '-'}{tx.amount.toLocaleString()}
                  </span>
                </td>

                {/* Counterparty */}
                <td className="py-4 px-3">
                  <CounterpartyCell tx={tx} />
                </td>

                {/* Status */}
                <td className="py-4 px-3">
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
                </td>

                {/* Tx ID */}
                <td className="py-4 px-3">
                  <span className="text-xs font-mono text-charcoalGray">{truncateTxId(tx.txId)}</span>
                </td>

                {/* Action */}
                <td className="py-4 pl-3 text-right">
                  <button
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-deepSlate text-xs text-charcoalGray hover:text-white hover:border-primary transition-colors"
                  >
                    <span>Details</span>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
