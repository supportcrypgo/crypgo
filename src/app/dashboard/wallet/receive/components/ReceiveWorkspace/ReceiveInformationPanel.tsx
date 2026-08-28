'use client';

import React from 'react';
import { ReceiveAddressInfo, ReceiveAssetInfo, NetworkOption } from '../types';
import ImportantTips from '../ReceiveInformation/ImportantTips';

interface ReceiveInformationPanelProps {
  addressInfo: ReceiveAddressInfo | null;
  selectedAsset: ReceiveAssetInfo;
  selectedNetwork: NetworkOption;
  isGenerating: boolean;
  qrCodeDataUrl?: string;
  onCopyAddress: () => void;
  onCopyMemo?: () => void;
  onViewExplorer: () => void;
  onShareQR: () => void;
  onDownloadQR: () => void;
  onCopyURI: () => void;
}

export default function ReceiveInformationPanel({
  addressInfo,
  selectedAsset,
  selectedNetwork,
  isGenerating,
  qrCodeDataUrl,
  onCopyAddress,
  onCopyMemo,
  onViewExplorer,
  onShareQR,
  onDownloadQR,
  onCopyURI,
}: ReceiveInformationPanelProps) {
  // Determine status based on network availability
  // In a real app, this might come from API or network health check
  const isActive = true; // Could be dynamic based on network health

  return (
    <div className="space-y-4">
      {/* Receive Details Card */}
      <div className="space-y-3 lg:bg-white/5 lg:border lg:border-white/10 lg:rounded-2xl lg:p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Receive Details</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-charcoalGray">Asset</span>
            <span className="text-sm font-medium text-white">{selectedAsset.ticker} ({selectedAsset.name})</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-charcoalGray">Network</span>
            <span className="text-sm font-medium text-white">{selectedNetwork.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-charcoalGray">Minimum Deposit</span>
            <span className="text-sm font-medium text-white">{selectedNetwork.minDeposit} {selectedAsset.ticker}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-charcoalGray">Confirmations Required</span>
            <span className="text-sm font-medium text-white">{selectedNetwork.confirmations}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-charcoalGray">Estimated Arrival</span>
            <span className="text-sm font-medium text-white">{selectedNetwork.estimatedArrival}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-charcoalGray">Status</span>
            <span className={`text-sm font-medium ${
              isActive ? 'text-green-400' : 'text-yellow-400'
            }`}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      <div className="hidden lg:block">
        <ImportantTips />
      </div>

      </div>
  );
}
