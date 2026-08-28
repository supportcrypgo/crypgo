'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { SendAssetInfo, NetworkOption, RecipientInfo } from './types';
import { SEND_ASSETS, validateAddress } from './assetData';
import AssetSelector from './AssetSelector';
import RecipientField from './RecipientField';
import AmountField from './AmountField';
import SendSummary from './SendInformation/SendSummary';
import ImportantTips from './SendInformation/ImportantTips';
import { useUnified } from '@/context/UnifiedContext';
import { toast } from 'sonner';
import { aggregateWalletAmountsByTicker } from '@/lib/walletBalances';

const FEE_PERCENTAGE = 0.01; // 1% uniform fee

export function SendWorkspace() {
  const { walletAssets, executeSendTransaction } = useUnified();

  // State for asset/network selection
  const [selectedAsset, setSelectedAsset] = useState<SendAssetInfo>(SEND_ASSETS[0]);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkOption>(
    SEND_ASSETS[0].networks[SEND_ASSETS[0].defaultNetworkIndex ?? 0]
  );
  const [availableAssets, setAvailableAssets] = useState<SendAssetInfo[]>(SEND_ASSETS);
  const [isSending, setIsSending] = useState(false);

  // State for user inputs
  const [recipient, setRecipient] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  
  // State for derived values
  const [recipientInfo, setRecipientInfo] = useState<RecipientInfo>({
    isValid: false,
    isValidNetwork: false,
    address: '',
  });
  const [estimatedArrival, setEstimatedArrival] = useState<string>(selectedNetwork.estimatedArrival);
  
  // Calculate total send amount - fee is 1% of send amount
  const sendAmount = parseFloat(amount) || 0;
  const feeAmount = sendAmount * FEE_PERCENTAGE;
  const totalAmount = sendAmount + feeAmount;

  const selectedBalance = useMemo(() => {
    return selectedAsset.balance || '0.00';
  }, [selectedAsset.balance]);

  // Refresh estimated arrival when network changes
  useEffect(() => {
    const network = SEND_ASSETS.find(a => a.ticker === selectedAsset.ticker)?.networks.find(
      n => n.id === selectedNetwork.id
    );
    if (network) {
      setEstimatedArrival(network.estimatedArrival);
    }
  }, [selectedNetwork, selectedAsset.ticker]);

  useEffect(() => {
    const balanceByTicker = aggregateWalletAmountsByTicker(walletAssets, 'availableQuantity');
    const nextAssets = SEND_ASSETS.map((asset) => ({
      ...asset,
      balance: (balanceByTicker[asset.ticker] ?? 0).toFixed(8),
    }));

    setAvailableAssets(nextAssets);
    setSelectedAsset((current) => {
      const next = nextAssets.find((asset) => asset.ticker === current.ticker);
      return next || nextAssets[0];
    });
  }, [walletAssets]);

  const handleAssetChange = (asset: SendAssetInfo) => {
    setSelectedAsset(asset);
    setSelectedNetwork(asset.networks[asset.defaultNetworkIndex ?? 0]);
  };

  const handleNetworkChange = (network: NetworkOption) => {
    setSelectedNetwork(network);
  };

  const handleSubmit = async () => {
    if (!recipientInfo.isValid || !amount || isSending) return;

    setIsSending(true);
    try {
      await executeSendTransaction({
        asset: selectedAsset.ticker,
        amount: sendAmount,
        to_address: recipientInfo.address,
        network: selectedNetwork.id,
      });
      toast.success(`Sent ${sendAmount} ${selectedAsset.ticker}`);
      setRecipient('');
      setAmount('');
      setRecipientInfo({ isValid: false, isValidNetwork: false, address: '' });
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send transaction');
    } finally {
      setIsSending(false);
    }
  };

  // Validate recipient address on change
  const handleRecipientChange = (address: string) => {
    setRecipient(address);
    const network = SEND_ASSETS.find(a => a.ticker === selectedAsset.ticker)?.networks.find(
      n => n.id === selectedNetwork.id
    );
    
    if (!network) {
      setRecipientInfo({ isValid: false, isValidNetwork: false, address });
      return;
    }

    const validationResult = validateAddress(address, network);
    setRecipientInfo({
      isValid: validationResult.isValid,
      isValidNetwork: validationResult.isValidNetwork,
      address: address.trim(),
      error: validationResult.error,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 lg:gap-8 h-full">
      {/* Left Column: Send Form */}
      <div className="lg:col-span-1 min-w-0 space-y-6">
        {/* Step 1: Asset Selector */}
        <AssetSelector
          selectedAsset={selectedAsset}
          selectedNetwork={selectedNetwork}
          availableAssets={availableAssets}
          onAssetChange={handleAssetChange}
          onNetworkChange={handleNetworkChange}
        />

        {/* Step 2: Recipient Field */}
        <RecipientField
          address={recipient}
          isValid={recipientInfo.isValid}
          isValidNetwork={recipientInfo.isValidNetwork}
          error={recipientInfo.error}
          onChange={handleRecipientChange}
        />

        {/* Step 3: Amount Field */}
        <AmountField
          asset={selectedAsset}
          network={selectedNetwork}
          amount={amount}
          networkFee={feeAmount}
          onAmountChange={setAmount}
        />

        {/* Step 4: Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!recipientInfo.isValid || !amount || isSending}
          className="w-full h-[50px] bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:bg-white/5 disabled:text-charcoalGray disabled:cursor-not-allowed transition-colors"
        >
          {isSending ? 'Sending...' : `Send ${amount} ${selectedAsset.ticker}`}
        </button>
      </div>

      {/* Right Column: Summary + Tips + History */}
      <div className="lg:col-span-1 min-w-0 space-y-6">
          <SendSummary
            asset={selectedAsset}
            network={selectedNetwork}
            recipient={recipientInfo.address || ''}
            amount={sendAmount}
            networkFee={feeAmount}
            totalAmount={totalAmount}
            estimatedArrival={estimatedArrival}
            balance={selectedBalance}
          />

        <ImportantTips asset={selectedAsset} network={selectedNetwork} />
      </div>
    </div>
  );
}
