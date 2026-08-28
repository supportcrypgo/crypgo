'use client';

import React, { useState, useRef, useEffect } from 'react';
import { SendAssetInfo, NetworkOption } from './types';

interface AssetSelectorProps {
  selectedAsset: SendAssetInfo;
  selectedNetwork: NetworkOption;
  availableAssets: SendAssetInfo[];
  onAssetChange: (asset: SendAssetInfo) => void;
  onNetworkChange: (network: NetworkOption) => void;
}

export default function AssetSelector({
  selectedAsset,
  selectedNetwork,
  availableAssets,
  onAssetChange,
  onNetworkChange,
}: AssetSelectorProps) {
  const [isAssetOpen, setIsAssetOpen] = useState(false);
  const [isNetworkOpen, setIsNetworkOpen] = useState(false);
  const assetRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<HTMLDivElement>(null);
  const assetSearch = useState<string>('');
  const [assetSearchState, setAssetSearchState] = useState('');

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (assetRef.current && !assetRef.current.contains(event.target as Node)) {
        setIsAssetOpen(false);
        setAssetSearchState('');
      }
      if (networkRef.current && !networkRef.current.contains(event.target as Node)) {
        setIsNetworkOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredAssets = availableAssets.filter((asset) => {
    const query = assetSearchState.toLowerCase();
    return (
      asset.name.toLowerCase().includes(query) ||
      asset.ticker.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-4">
      {/* Step 1: Asset Selector */}
      <div className="space-y-4 animate-in fade-in-50 slide-in-from-left-2 duration-200">
        {/* Asset Selector */}
        <div>
          <label className="text-xs font-medium text-charcoalGray uppercase tracking-wider mb-2 block">
            Asset
          </label>
          <div className="relative" ref={assetRef}>
            <button
              type="button"
              onClick={() => setIsAssetOpen(!isAssetOpen)}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/5 border border-white/5 hover:border-primary/30 focus:outline-none focus:border-primary/50 transition-colors"
            >
              <img
                src={selectedAsset.logo}
                alt={selectedAsset.ticker}
                className="w-8 h-8 rounded-full"
              />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-white truncate">{selectedAsset.ticker}</p>
                <p className="text-xs text-charcoalGray truncate">{selectedAsset.name}</p>
              </div>
              {selectedAsset.balance !== undefined && (
                <div className="text-right">
                  <p className="text-xs text-charcoalGray">Available</p>
                  <p className="text-sm font-medium text-white whitespace-nowrap">
                    {Number(selectedAsset.balance).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                  </p>
                </div>
              )}
              <svg
                className={`w-4 h-4 text-charcoalGray transition-transform ${isAssetOpen ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {isAssetOpen && (
              <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-deepSlate border border-white/5 rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
                <div className="p-3 border-b border-white/5">
                  <div className="relative">
                    <input
                      type="text"
                      value={assetSearchState}
                      onChange={(e) => setAssetSearchState(e.target.value)}
                      placeholder="Search assets..."
                      className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/5 rounded-xl text-white text-sm focus:outline-none focus:border-primary/50 placeholder-charcoalGray"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-64 overflow-auto grid grid-cols-2 gap-1 p-2">
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
                          setAssetSearchState('');
                        }}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors ${
                          selectedAsset.ticker === asset.ticker ? 'bg-primary/10' : ''
                        }`}
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
        </div>

        {/* Network Selector */}
        <div>
          <label className="text-xs font-medium text-charcoalGray uppercase tracking-wider mb-2 block">
            Network
          </label>
          <div className="relative" ref={networkRef}>
            <button
              type="button"
              onClick={() => setIsNetworkOpen(!isNetworkOpen)}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/5 border border-white/5 hover:border-primary/30 focus:outline-none focus:border-primary/50 transition-colors"
            >
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-white truncate">{selectedNetwork.name}</p>
                {selectedNetwork.shortName && (
                  <p className="text-xs text-charcoalGray truncate">{selectedNetwork.shortName}</p>
                )}
              </div>
              {selectedNetwork.badge && (
                <span className="px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded-full">
                  {selectedNetwork.badge}
                </span>
              )}
              <svg
                className={`w-4 h-4 text-charcoalGray transition-transform ${isNetworkOpen ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {isNetworkOpen && (
              <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-deepSlate border border-white/5 rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
                <div className="p-2 max-h-48 overflow-auto">
                  {selectedAsset.networks.map((network) => (
                    <button
                      key={network.id}
                      type="button"
                      onClick={() => {
                        onNetworkChange(network);
                        setIsNetworkOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors ${
                        selectedNetwork.id === network.id ? 'bg-primary/10' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-white truncate">{network.name}</p>
                        {network.shortName && (
                          <p className="text-xs text-charcoalGray truncate">{network.shortName}</p>
                        )}
                      </div>
                      {network.badge && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded-full">
                          {network.badge}
                        </span>
                      )}
                      {selectedNetwork.id === network.id && (
                        <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}