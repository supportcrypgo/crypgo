'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronRight, Copy, ExternalLink, Share2, Download, Shield } from 'lucide-react';
import { ReceiveAssetInfo, NetworkOption, ReceiveAddressInfo } from '../types';

interface ReceiveWorkspaceLeftProps {
  selectedAsset: ReceiveAssetInfo;
  selectedNetwork: NetworkOption;
  addressInfo: ReceiveAddressInfo | null;
  isGenerating: boolean;
  onAssetChange: (asset: ReceiveAssetInfo) => void;
  onNetworkChange: (network: NetworkOption) => void;
  onCopyAddress: () => void;
  onCopyMemo?: () => void;
  onViewExplorer: () => void;
  onShareQR: () => void;
  onDownloadQR: () => void;
  onCopyURI: () => void;
  availableAssets: ReceiveAssetInfo[];
  showHowItWorks?: boolean;
  onShowHowItWorks?: () => void;
}

export default function ReceiveWorkspaceLeft({
  selectedAsset,
  selectedNetwork,
  addressInfo,
  isGenerating,
  onAssetChange,
  onNetworkChange,
  onCopyAddress,
  onCopyMemo,
  onViewExplorer,
  onShareQR,
  onDownloadQR,
  onCopyURI,
  availableAssets,
  showHowItWorks = false,
  onShowHowItWorks,
}: ReceiveWorkspaceLeftProps) {
  const [isAssetOpen, setIsAssetOpen] = useState(false);
  const [isNetworkOpen, setIsNetworkOpen] = useState(false);
  const [assetSearch, setAssetSearch] = useState('');
  const [qrSize] = useState(180);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const assetTriggerRef = useRef<HTMLButtonElement>(null);
  const assetDropdownRef = useRef<HTMLDivElement>(null);
  const networkTriggerRef = useRef<HTMLButtonElement>(null);
  const networkDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
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
      }
    }

    if (isAssetOpen || isNetworkOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAssetOpen, isNetworkOpen]);

  // Generate deterministic pseudo-QR pattern from the address
  useEffect(() => {
    if (!canvasRef.current || !addressInfo?.address) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let hash = 0;
    for (let i = 0; i < addressInfo.address.length; i++) {
      hash = ((hash << 5) - hash) + addressInfo.address.charCodeAt(i);
      hash |= 0;
    }

    const cells = 21;
    const cellSize = qrSize / cells;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, qrSize, qrSize);

    const drawFinder = (x: number, y: number) => {
      ctx.fillStyle = '#0a0b14';
      ctx.fillRect(x * cellSize, y * cellSize, cellSize * 7, cellSize * 7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect((x + 1) * cellSize, (y + 1) * cellSize, cellSize * 5, cellSize * 5);
      ctx.fillStyle = '#0a0b14';
      ctx.fillRect((x + 2) * cellSize, (y + 2) * cellSize, cellSize * 3, cellSize * 3);
    };

    drawFinder(0, 0);
    drawFinder(cells - 7, 0);
    drawFinder(0, cells - 7);

    for (let row = 0; row < cells; row++) {
      for (let col = 0; col < cells; col++) {
        const inFinder =
          (row < 8 && col < 8) ||
          (row < 8 && col >= cells - 8) ||
          (row >= cells - 8 && col < 8);
        if (inFinder) continue;

        hash ^= hash << 13;
        hash ^= hash >> 17;
        hash ^= hash << 5;
        const bit = (hash >> ((row * col) % 32)) & 1;

        if (bit) {
          ctx.fillStyle = '#0a0b14';
          ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }
  }, [addressInfo?.address, qrSize]);

  const filteredAssets = availableAssets.filter((asset) => {
    const query = assetSearch.toLowerCase();
    return (
      asset.name.toLowerCase().includes(query) ||
      asset.ticker.toLowerCase().includes(query)
    );
  });

  const handleAssetSelect = (asset: ReceiveAssetInfo) => {
    onAssetChange(asset);
    setIsAssetOpen(false);
    setAssetSearch('');
  };

  const handleNetworkSelect = (network: NetworkOption) => {
    onNetworkChange(network);
    setIsNetworkOpen(false);
  };

  return (
    <div id="receive-workspace-left" className="flex flex-col h-full space-y-6">
      {/* Header removed per user request */}

      {/* Asset & Network Selection */}
      <div className="space-y-4 animate-in fade-in-50 slide-in-from-left-2 duration-200">
        {/* Asset Selector */}
        <div>
          <label className="text-xs font-medium text-charcoalGray uppercase tracking-wider mb-2 block">
            Asset
          </label>
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
              <ChevronRight className={`w-4 h-4 text-charcoalGray transition-transform ${isAssetOpen ? 'rotate-90' : ''}`} />
            </button>

            {isAssetOpen && (
              <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-deepSlate border border-white/5 rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
                <div className="p-3 border-b border-white/5">
                  <div className="relative">
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
                        onClick={() => handleAssetSelect(asset)}
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
          <div className="relative" ref={networkDropdownRef}>
            <button
              ref={networkTriggerRef}
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
              <ChevronRight className={`w-4 h-4 text-charcoalGray transition-transform ${isNetworkOpen ? 'rotate-90' : ''}`} />
            </button>

            {isNetworkOpen && (
              <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-deepSlate border border-white/5 rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
                <div className="p-2 max-h-48 overflow-auto">
                  {selectedAsset.networks.map((network) => (
                    <button
                      key={network.id}
                      type="button"
                      onClick={() => handleNetworkSelect(network)}
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

      {/* Address Details + QR Code + Actions */}
      {addressInfo && (
        <div className="space-y-4 animate-in fade-in-50 slide-in-from-left-2 duration-200" role="region" aria-label="Deposit address details">
          {/* Address Card with QR */}
          <div className="overflow-hidden lg:rounded-2xl lg:bg-white/5 lg:border lg:border-white/5">
            <div className="px-0 py-0 lg:p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <img
                    src={addressInfo.asset.logo}
                    alt={addressInfo.asset.name}
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <p className="text-lg font-semibold text-white">{addressInfo.asset.ticker}</p>
                    <p className="text-sm text-charcoalGray capitalize">
                      {addressInfo.network.shortName || addressInfo.network.name.toLowerCase()} network
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onViewExplorer}
                  className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline">View on Explorer</span>
                </button>
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center gap-3 mb-4">
                <div className="bg-white p-4 rounded-xl shadow-sm">
                  <canvas ref={canvasRef} width={qrSize} height={qrSize} className="block" />
                </div>
                <p className="text-xs text-charcoalGray text-center break-all max-w-full">
                  Scan to receive on <span className="text-white/75">{addressInfo.network.name}</span>
                </p>
              </div>

              {/* Address */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs font-medium text-charcoalGray uppercase tracking-wider">
                    {addressInfo.network.addressType === 'bech32' ? 'Bech32 Address' :
                     addressInfo.network.addressType === 'hex' ? 'Hex Address' : 'Base58 Address'}
                  </label>
                  {addressInfo.network.badge && (
                    <span className="px-1.5 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded">
                      {addressInfo.network.badge}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-sm text-white bg-white/5 px-4 py-3 rounded-xl border border-white/5 truncate md:break-all md:whitespace-normal">
                    {addressInfo.address}
                  </code>
                  <button
                    type="button"
                    onClick={onCopyAddress}
                    className="p-2.5 bg-white/5 rounded-xl text-charcoalGray hover:bg-white/10 hover:text-white transition-colors shrink-0"
                    aria-label="Copy address"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Memo / Destination Tag */}
              {addressInfo.memo && (
                <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs font-medium text-amber-300 uppercase tracking-wider">
                      {addressInfo.network.memoLabel || 'Memo'}
                    </label>
                    <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-300 rounded">
                      Required
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono text-sm text-amber-200 bg-white/5 px-4 py-3 rounded-xl border border-amber-500/20 break-all">
                      {addressInfo.memo}
                    </code>
                    {onCopyMemo && (
                      <button
                        type="button"
                        onClick={onCopyMemo}
                        className="p-2.5 bg-white/5 rounded-xl text-charcoalGray hover:bg-white/10 hover:text-white transition-colors shrink-0"
                        aria-label="Copy memo"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Action Buttons Row */}
            <div className="flex flex-wrap gap-3 px-0 pt-4 lg:border-t lg:border-white/5 lg:px-5 lg:pb-5">
              <button
                type="button"
                onClick={onShareQR}
                className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share <span className="hidden sm:inline">QR Code</span>
              </button>
              <button
                type="button"
                onClick={onDownloadQR}
                className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download <span className="hidden sm:inline">QR Code</span>
              </button>
            </div>
          </div>

          {/* Network Warning */}
          <div className="lg:rounded-2xl lg:bg-white/5 lg:border lg:border-white/5 lg:p-4">
            <div className="flex items-start gap-3">
              <Shield className="hidden lg:block w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-white/80">
                  {addressInfo.network.warning}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
