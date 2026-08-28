'use client';

import React, { useState, useEffect } from 'react';
import { Copy, Check, RefreshCw, Clock, ExternalLink } from 'lucide-react';
import { ReceiveAddressInfo, NetworkOption } from './types';

interface AddressInfoCardProps {
  addressInfo: ReceiveAddressInfo | null;
  isGenerating: boolean;
  copiedField: 'address' | 'memo' | null;
  onCopy: (field: 'address' | 'memo', value: string) => Promise<void>;
  onGenerateNew: () => void;
  showNewAddress: boolean;
}

export default function AddressInfoCard({
  addressInfo,
  isGenerating,
  copiedField,
  onCopy,
  onGenerateNew,
  showNewAddress,
}: AddressInfoCardProps) {
  const [showFullAddress, setShowFullAddress] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Calculate time remaining for address expiry
  useEffect(() => {
    if (!addressInfo?.expiresAt) return;
    
    const updateTime = () => {
      const now = new Date().getTime();
      const expiry = new Date(addressInfo.expiresAt!).getTime();
      const diff = expiry - now;
      
      if (diff <= 0) {
        setTimeRemaining('Expired');
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m remaining`);
      } else {
        setTimeRemaining(`${minutes}m remaining`);
      }
    };
    
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [addressInfo]);

  if (!addressInfo) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/5 p-6 animate-pulse">
        <div className="space-y-3">
          <div className="h-4 bg-white/10 rounded w-1/4" />
          <div className="h-10 bg-white/10 rounded" />
          <div className="h-4 bg-white/10 rounded w-1/2" />
        </div>
      </div>
    );
  }

  const { address, memo, network, asset, expiresAt } = addressInfo;

  const formatAddress = (addr: string, showFull: boolean) => {
    if (showFull || addr.length <= 20) return addr;
    const prefix = addr.slice(0, 10);
    const suffix = addr.slice(-8);
    return `${prefix}...${suffix}`;
  };

  return (
    <div className="rounded-2xl bg-white/5 border border-white/5 overflow-hidden">
      {/* Main Address Card */}
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <img
              src={asset.logo}
              alt={asset.name}
              className="w-10 h-10 rounded-full"
            />
            <div>
              <p className="text-lg font-semibold text-white">{asset.ticker}</p>
              <p className="text-sm text-charcoalGray capitalize">{network.shortName || network.name.toLowerCase()} network</p>
            </div>
          </div>
          
          {/* New Address Badge */}
          {showNewAddress && (
            <button
              onClick={onGenerateNew}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Generating...' : 'Generate new address'}
            </button>
          )}
        </div>

        {/* Address */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs font-medium text-charcoalGray uppercase tracking-wider">
              {network.addressType === 'bech32' ? 'Bech32 Address' : 
               network.addressType === 'hex' ? 'Hex Address' : 'Base58 Address'}
            </label>
            {network.badge && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded">
                {network.badge}
              </span>
            )}
          </div>
          <div className="relative">
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm text-white bg-white/5 px-4 py-3 rounded-xl border border-white/5 break-all">
                {formatAddress(address, showFullAddress)}
              </code>
              <button
                onClick={() => setShowFullAddress(!showFullAddress)}
                className="p-2 bg-white/5 rounded-lg text-charcoalGray hover:text-white hover:bg-white/10 transition-colors"
                aria-label={showFullAddress ? 'Truncate address' : 'Show full address'}
              >
                {showFullAddress ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 12H6" />
                    <path d="M12 18V6" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 18V6" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => onCopy('address', address)}
                disabled={copiedField === 'address' || isGenerating}
                className={`p-2 rounded-lg transition-colors ${
                  copiedField === 'address'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-white/5 text-charcoalGray hover:text-white hover:bg-white/10'
                }`}
                aria-label={copiedField === 'address' ? 'Copied!' : 'Copy address'}
              >
                {copiedField === 'address' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Memo / Destination Tag */}
        {memo && (
          <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs font-medium text-amber-300 uppercase tracking-wider">
                {network.memoLabel || 'Memo'}
              </label>
              <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-300 rounded">
                Required
              </span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm text-amber-200 bg-white/5 px-4 py-3 rounded-xl border border-amber-500/20 break-all">
                {memo}
              </code>
              <button
                onClick={() => onCopy('memo', memo)}
                disabled={copiedField === 'memo' || isGenerating}
                className={`p-2 rounded-lg transition-colors ${
                  copiedField === 'memo'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-white/5 text-charcoalGray hover:text-white hover:bg-white/10'
                }`}
                aria-label={copiedField === 'memo' ? 'Copied!' : 'Copy memo'}
              >
                {copiedField === 'memo' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Network Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-white/5">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{network.confirmations}</p>
            <p className="text-xs text-charcoalGray mt-1">{network.confirmationsLabel || 'Confirmations'}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{network.estimatedArrival}</p>
            <p className="text-xs text-charcoalGray mt-1">Est. arrival</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">1%</p>
            <p className="text-xs text-charcoalGray mt-1">Network fee</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">
              {timeRemaining || (expiresAt ? '24h' : '—')}
            </p>
            <p className="text-xs text-charcoalGray mt-1">Address expiry</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-6 pb-6 pt-4 border-t border-white/5 flex flex-wrap gap-3">
        <button
          onClick={() => onCopy('address', address)}
          className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors"
        >
          <Copy className="w-4 h-4" />
          Copy Address
        </button>
        {memo && (
          <button
            onClick={() => onCopy('memo', memo)}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500/20 text-amber-300 font-medium rounded-xl hover:bg-amber-500/30 transition-colors border border-amber-500/20"
          >
            <Copy className="w-4 h-4" />
            Copy Memo
          </button>
        )}
        <a
          href={`${network.explorerUrl}${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 text-charcoalGray font-medium rounded-xl hover:bg-white/10 hover:text-white transition-colors border border-white/5"
        >
          <ExternalLink className="w-4 h-4" />
          View on Explorer
        </a>
      </div>
    </div>
  );
}