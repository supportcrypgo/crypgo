'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ReceiveAssetInfo, NetworkOption, ReceiveAddressInfo } from './types';
import { RECEIVE_ASSETS, generateAddress, generateMemo } from './assetData';
import ReceiveWorkspaceLeft from './ReceiveWorkspace/ReceiveWorkspaceLeft';
import ReceiveInformationPanel from './ReceiveWorkspace/ReceiveInformationPanel';
import { useUnified } from '@/context/UnifiedContext';
import { toast } from 'sonner';

export function ReceiveWorkspace() {
  const { executeReceiveTransaction } = useUnified();
  const executeReceiveTransactionRef = useRef(executeReceiveTransaction);

  // State for asset/network selection
  const [selectedAsset, setSelectedAsset] = useState<ReceiveAssetInfo>(RECEIVE_ASSETS[0]);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkOption>(RECEIVE_ASSETS[0].networks[0]);
  
  // State for generated address
  const [addressInfo, setAddressInfo] = useState<ReceiveAddressInfo | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedField, setCopiedField] = useState<'address' | 'memo' | null>(null);

  useEffect(() => {
    executeReceiveTransactionRef.current = executeReceiveTransaction;
  }, [executeReceiveTransaction]);

  // Generate new address when asset/network changes or manually requested
  const generateNewAddress = useCallback(async () => {
    setIsGenerating(true);
    try {
      const response = await executeReceiveTransactionRef.current({ asset: selectedAsset.ticker });
      const address = response?.address || generateAddress(selectedNetwork);
      const memo = response?.memo || generateMemo(selectedNetwork);

      const newAddressInfo: ReceiveAddressInfo = {
        address,
        memo,
        network: selectedNetwork,
        asset: selectedAsset,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      setAddressInfo(newAddressInfo);
    } catch (error) {
      const address = generateAddress(selectedNetwork);
      const memo = generateMemo(selectedNetwork);
      setAddressInfo({
        address,
        memo,
        network: selectedNetwork,
        asset: selectedAsset,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      toast.error('Loaded a fallback deposit address');
      console.error('Failed to load deposit address:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [selectedAsset.ticker, selectedNetwork.id]);

  // Initial address generation
  useEffect(() => {
    generateNewAddress();
  }, [generateNewAddress]);

  const handleCopy = async (field: 'address' | 'memo', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleAssetChange = (asset: ReceiveAssetInfo) => {
    setSelectedAsset(asset);
    setSelectedNetwork(asset.networks[asset.defaultNetworkIndex ?? 0]);
  };

  const handleNetworkChange = (network: NetworkOption) => {
    setSelectedNetwork(network);
  };

  // Build explorer URL
  const getExplorerUrl = (address: string, network: NetworkOption): string => {
    return network.explorerUrl.replace('{address}', address);
  };

  // Action handlers
  const handleCopyAddress = () => {
    if (addressInfo?.address) {
      handleCopy('address', addressInfo.address);
    }
  };

  const handleCopyMemo = () => {
    if (addressInfo?.memo) {
      handleCopy('memo', addressInfo.memo);
    }
  };

  const handleViewExplorer = () => {
    if (addressInfo?.address) {
      const url = getExplorerUrl(addressInfo.address, addressInfo.network);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleShareQR = () => {
    if (addressInfo?.address && navigator.share) {
      navigator.share({
        title: `Receive ${addressInfo.asset.ticker}`,
        text: `Send ${addressInfo.asset.ticker} to this address`,
        url: getExplorerUrl(addressInfo.address, addressInfo.network),
      }).catch(() => {});
    }
  };

  const handleDownloadQR = () => {
    // The canvas is now in the left panel
    const canvas = document.querySelector('#receive-workspace-left canvas, [data-receive-workspace] canvas') as HTMLCanvasElement;
    if (canvas) {
      const link = document.createElement('a');
      link.download = `${addressInfo?.asset.ticker || 'crypto'}-deposit-qr.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  const handleCopyURI = () => {
    if (addressInfo?.address) {
      const generateQRValue = (address: string, network: NetworkOption, memo?: string): string => {
        if (network.id === 'bitcoin') {
          return `bitcoin:${address}`;
        }
        if (network.id === 'ethereum' || network.id === 'bnb' || network.id === 'polygon' || 
            network.id === 'arbitrum' || network.id === 'optimism' || network.id === 'base' || 
            network.id === 'avalanche') {
          return `ethereum:${address}@${network.name.toLowerCase().replace(/\s+/g, '')}${memo ? `?value=${memo}` : ''}`;
        }
        if (network.id === 'solana') {
          return `solana:${address}${memo ? `?memo=${memo}` : ''}`;
        }
        if (network.id === 'xrp') {
          return `xrpl:${address}${memo ? `?dt=${memo}` : ''}`;
        }
        if (network.id === 'tron') {
          return `tron:${address}${memo ? `?memo=${memo}` : ''}`;
        }
        return `${network.id}:${address}`;
      };
      
      const uri = generateQRValue(addressInfo.address, addressInfo.network, addressInfo.memo);
      handleCopy('address', uri);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 lg:gap-8 h-full">
      {/* Left Column: Steps & Address Details */}
      <div className="lg:col-span-1 min-w-0">
          <ReceiveWorkspaceLeft
            selectedAsset={selectedAsset}
            selectedNetwork={selectedNetwork}
            addressInfo={addressInfo}
            isGenerating={isGenerating}
            onAssetChange={handleAssetChange}
            onNetworkChange={handleNetworkChange}
            onCopyAddress={handleCopyAddress}
            onCopyMemo={handleCopyMemo}
            onViewExplorer={handleViewExplorer}
            onShareQR={handleShareQR}
            onDownloadQR={handleDownloadQR}
            onCopyURI={handleCopyURI}
            availableAssets={RECEIVE_ASSETS}
            showHowItWorks
            onShowHowItWorks={() => {}}
          />
      </div>

      {/* Right Column: QR + Details + Tips + History */}
      <div className="lg:col-span-1 min-w-0" id="receive-info-panel">
        <ReceiveInformationPanel
          addressInfo={addressInfo}
          selectedAsset={selectedAsset}
          selectedNetwork={selectedNetwork}
          isGenerating={isGenerating}
          onCopyAddress={handleCopyAddress}
          onCopyMemo={handleCopyMemo}
          onViewExplorer={handleViewExplorer}
          onShareQR={handleShareQR}
          onDownloadQR={handleDownloadQR}
          onCopyURI={handleCopyURI}
        />
      </div>
    </div>
  );
}
