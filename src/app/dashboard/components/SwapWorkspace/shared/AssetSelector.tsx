'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { SWAP_ASSETS, type SwapAsset } from './types';
import { getAssetIconPath } from '@/lib/assetIcons';

/**
 * Handle image error - fall back to local icon
 */
function handleImageError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  ticker: string,
  fallbackLogo?: string
) {
  const target = e.target as HTMLImageElement;
  const localIcon = getAssetIconPath(ticker, fallbackLogo);
  if (target.src !== localIcon) {
    target.src = localIcon;
    target.onerror = null; // Prevent infinite loop
  }
}

interface AssetSelectorProps {
  selectedAsset: SwapAsset | null;
  onSelect: (asset: SwapAsset) => void;
  assets?: SwapAsset[];
  placeholder?: string;
  disabled?: boolean;
  excludeAsset?: SwapAsset | null; // Asset to exclude from list (e.g., can't swap BTC for BTC)
  label?: string;
}

export default function AssetSelector({
  selectedAsset,
  onSelect,
  assets = SWAP_ASSETS,
  placeholder = 'Select asset',
  disabled = false,
  excludeAsset = null,
  label,
}: AssetSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filteredAssets = assets.filter((asset) => {
    if (excludeAsset && asset.id === excludeAsset.id) return false;
    if (selectedAsset && asset.id === selectedAsset.id) return true; // Always show selected
    const query = searchQuery.toLowerCase();
    return (
      asset.name.toLowerCase().includes(query) ||
      asset.ticker.toLowerCase().includes(query)
    );
  });

  const handleSelect = (asset: SwapAsset) => {
    onSelect(asset);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null as any);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/5 border border-white/5 hover:border-primary/30 focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${selectedAsset ? 'bg-white/5' : ''}`}
      >
            {selectedAsset ? (
              <>
                <img
                  src={getAssetIconPath(selectedAsset.ticker, selectedAsset.logo)}
                  alt={selectedAsset.name}
                  className="w-6 h-6 rounded-full"
                  onError={(e) => handleImageError(e, selectedAsset.ticker, selectedAsset.logo)}
                />
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-white truncate">{selectedAsset.ticker}</p>
                  <p className="text-xs text-charcoalGray truncate">{selectedAsset.name}</p>
                </div>
                {selectedAsset.balance !== undefined && (
                  <div className="text-right">
                    <p className="text-xs text-charcoalGray">Available</p>
                    <p className="text-sm font-medium text-white whitespace-nowrap">
                      {selectedAsset.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </p>
                  </div>
                )}
                <ChevronDown className="w-4 h-4 text-charcoalGray" />
              </>
            ) : (
          <>
            <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
              <Search className="w-4 h-4 text-charcoalGray" />
            </div>
            <span className="text-sm text-charcoalGray">{placeholder}</span>
            <ChevronDown className="w-4 h-4 text-charcoalGray ml-auto" />
          </>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 z-50 mt-2 bg-deepSlate border border-white/5 rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150"
        >
          {/* Search */}
          <div className="p-3 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoalGray" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assets..."
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/5 rounded-xl text-white text-sm focus:outline-none focus:border-primary/50 placeholder-charcoalGray"
                autoFocus
              />
            </div>
          </div>

          {/* Asset List */}
          <div className="max-h-64 overflow-auto">
            {filteredAssets.length === 0 ? (
              <div className="p-6 text-center text-charcoalGray text-sm">
                No assets found
              </div>
            ) : (
              filteredAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => handleSelect(asset)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors ${
                    selectedAsset?.id === asset.id ? 'bg-primary/10' : ''
                  }`}
                >
                  <img
                    src={getAssetIconPath(asset.ticker, asset.logo)}
                    alt={asset.name}
                    className="w-6 h-6 rounded-full"
                    onError={(e) => handleImageError(e, asset.ticker, asset.logo)}
                  />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-white truncate">{asset.ticker}</p>
                    <p className="text-xs text-charcoalGray truncate">{asset.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-charcoalGray">Available</p>
                    <p className="text-sm font-medium text-white whitespace-nowrap">
                      {asset.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </p>
                  </div>
                  {selectedAsset?.id === asset.id && (
                    <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
