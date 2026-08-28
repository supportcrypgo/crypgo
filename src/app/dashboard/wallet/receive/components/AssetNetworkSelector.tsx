'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Grid, List } from 'lucide-react';
import { ReceiveAssetInfo, NetworkOption } from './types';

interface AssetNetworkSelectorProps {
  selectedAsset: ReceiveAssetInfo;
  selectedNetwork: NetworkOption;
  onAssetChange: (asset: ReceiveAssetInfo) => void;
  onNetworkChange: (network: NetworkOption) => void;
  availableAssets: ReceiveAssetInfo[];
}

export default function AssetNetworkSelector({
  selectedAsset,
  selectedNetwork,
  onAssetChange,
  onNetworkChange,
  availableAssets,
}: AssetNetworkSelectorProps) {
  const [assetSearch, setAssetSearch] = useState('');
  const [networkSearch, setNetworkSearch] = useState('');
  const [isAssetOpen, setIsAssetOpen] = useState(false);
  const [isNetworkOpen, setIsNetworkOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const assetTriggerRef = useRef<HTMLButtonElement>(null);
  const assetDropdownRef = useRef<HTMLDivElement>(null);
  const networkTriggerRef = useRef<HTMLButtonElement>(null);
  const networkDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        assetDropdownRef.current &&
        !assetDropdownRef.current.contains(event.target as Node) &&
        assetTriggerRef.current &&
        !assetTriggerRef.current.contains(event.target as Node)
      ) {
        setIsAssetOpen(false);
        setAssetSearch('');
      }
      if (
        networkDropdownRef.current &&
        !networkDropdownRef.current.contains(event.target as Node) &&
        networkTriggerRef.current &&
        !networkTriggerRef.current.contains(event.target as Node)
      ) {
        setIsNetworkOpen(false);
        setNetworkSearch('');
      }
    }

    if (isAssetOpen || isNetworkOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAssetOpen, isNetworkOpen]);

  const filteredAssets = availableAssets.filter((asset) => {
    const query = assetSearch.toLowerCase();
    return (
      asset.name.toLowerCase().includes(query) ||
      asset.ticker.toLowerCase().includes(query)
    );
  });

  const filteredNetworks = selectedAsset.networks.filter((network) => {
    const query = networkSearch.toLowerCase();
    return (
      network.name.toLowerCase().includes(query) ||
      network.shortName?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Asset Selector */}
      <div className="relative" ref={assetDropdownRef}>
        <button
          ref={assetTriggerRef}
          type="button"
          onClick={() => setIsAssetOpen(!isAssetOpen)}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/5 border border-white/5 hover:border-primary/30 focus:outline-none focus:border-primary/50 transition-colors"
        >
          <img
            src={selectedAsset.logo}
            alt={selectedAsset.name}
            className="w-8 h-8 rounded-full"
          />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-white truncate">{selectedAsset.ticker}</p>
            <p className="text-xs text-charcoalGray truncate">{selectedAsset.name}</p>
          </div>
          <ChevronDown className={`w-4 h-4 text-charcoalGray transition-transform ${isAssetOpen ? 'rotate-180' : ''}`} />
        </button>

        {isAssetOpen && (
          <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-deepSlate border border-white/5 rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="p-3 border-b border-white/5 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoalGray" />
                <input
                  type="text"
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                  placeholder="Search assets..."
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/5 rounded-xl text-white text-sm focus:outline-none focus:border-primary/50 placeholder-charcoalGray"
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="p-2 bg-white/5 rounded-lg text-charcoalGray hover:text-white hover:bg-white/10 transition-colors"
                aria-label={viewMode === 'grid' ? 'List view' : 'Grid view'}
              >
                {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
              </button>
            </div>
            <div className={`max-h-64 overflow-auto ${viewMode === 'grid' ? 'grid grid-cols-2 gap-1 p-2' : 'p-1'}`}>
              {filteredAssets.length === 0 ? (
                <div className="p-6 text-center text-charcoalGray text-sm col-span-full">
                  No assets found
                </div>
              ) : (
                filteredAssets.map((asset) => (
                  <button
                    key={asset.ticker}
                    type="button"
                    onClick={() => {
                      onAssetChange(asset);
                      setIsAssetOpen(false);
                      setAssetSearch('');
                    }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors ${
                      selectedAsset.ticker === asset.ticker ? 'bg-primary/10' : ''
                    } ${viewMode === 'grid' ? '' : 'w-full'}`}
                  >
                    <img
                      src={asset.logo}
                      alt={asset.name}
                      className="w-6 h-6 rounded-full"
                    />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-white truncate">{asset.ticker}</p>
                      <p className="text-xs text-charcoalGray truncate">{asset.name}</p>
                    </div>
                    {selectedAsset.ticker === asset.ticker && (
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

      {/* Network Selector */}
      <div className="relative" ref={networkDropdownRef}>
        <button
          ref={networkTriggerRef}
          type="button"
          onClick={() => setIsNetworkOpen(!isNetworkOpen)}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/5 border border-white/5 hover:border-primary/30 focus:outline-none focus:border-primary/50 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-medium text-charcoalGray">
            {selectedNetwork.shortName?.slice(0, 4) || selectedNetwork.name.slice(0, 4)}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-white truncate">
              {selectedNetwork.shortName ? `${selectedNetwork.shortName} • ${selectedNetwork.name}` : selectedNetwork.name}
            </p>
            {selectedNetwork.badge && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/20 text-primary">
                {selectedNetwork.badge}
              </span>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-charcoalGray transition-transform ${isNetworkOpen ? 'rotate-180' : ''}`} />
        </button>

        {isNetworkOpen && (
          <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-deepSlate border border-white/5 rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="p-3 border-b border-white/5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoalGray" />
                <input
                  type="text"
                  value={networkSearch}
                  onChange={(e) => setNetworkSearch(e.target.value)}
                  placeholder="Search networks..."
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/5 rounded-xl text-white text-sm focus:outline-none focus:border-primary/50 placeholder-charcoalGray"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-64 overflow-auto p-1">
              {filteredNetworks.length === 0 ? (
                <div className="p-6 text-center text-charcoalGray text-sm">
                  No networks found
                </div>
              ) : (
                filteredNetworks.map((network) => (
                  <button
                    key={network.id}
                    type="button"
                    onClick={() => {
                      onNetworkChange(network);
                      setIsNetworkOpen(false);
                      setNetworkSearch('');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors ${
                      selectedNetwork.id === network.id ? 'bg-primary/10' : ''
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-medium text-charcoalGray">
                      {network.shortName?.slice(0, 4) || network.name.slice(0, 4)}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-white truncate">
                        {network.shortName ? `${network.shortName} • ${network.name}` : network.name}
                      </p>
                      <p className="text-xs text-charcoalGray">
                        Min: {network.minDeposit} {network.minDepositInUsd && `(${network.minDepositInUsd})`}
                      </p>
                    </div>
                    {network.badge && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/20 text-primary">
                        {network.badge}
                      </span>
                    )}
                    {selectedNetwork.id === network.id && (
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
    </div>
  );
}