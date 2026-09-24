'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { SendAssetInfo, NetworkOption, RecipientInfo } from './types';
import { SEND_ASSETS, validateAddress } from './assetData';
import AssetSelector from './AssetSelector';
import RecipientField from './RecipientField';
import AmountField from './AmountField';
import SendSummary from './SendInformation/SendSummary';
import ImportantTips from './SendInformation/ImportantTips';
import { useUnified } from '@/context/UnifiedContext';
import { aggregateWalletAmountsByTicker } from '@/lib/walletBalances';
import CautionModal from '@/components/CautionModal';
import { isTransactionCautionError } from '@/data/api';

const FEE_PERCENTAGE = 0.001; // 0.1% backend withdrawal fee

interface SendWorkspaceProps {
  onSuccessPageChange?: (visible: boolean) => void;
  onSuccessDetailsChange?: (details: {
    amount: string;
    ticker: string;
    name: string;
    logo: string;
  } | null) => void;
  desktopSuccessDetails?: {
    amount: string;
    ticker: string;
    name: string;
    logo: string;
  } | null;
}

export function SendWorkspace({ onSuccessPageChange, onSuccessDetailsChange, desktopSuccessDetails }: SendWorkspaceProps) {
  const router = useRouter();
  const { walletAssets, executeInternalTransfer } = useUnified();

  // State for asset/network selection
  const [selectedAsset, setSelectedAsset] = useState<SendAssetInfo>(SEND_ASSETS[0]);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkOption>(
    SEND_ASSETS[0].networks[SEND_ASSETS[0].defaultNetworkIndex ?? 0]
  );
  const [availableAssets, setAvailableAssets] = useState<SendAssetInfo[]>(SEND_ASSETS);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendTxId, setSendTxId] = useState('');
  const [sentSuccessDetails, setSentSuccessDetails] = useState<{ amount: string; ticker: string; name: string } | null>(null);
  const [cautionOpen, setCautionOpen] = useState(false);

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
  
  // Calculate total send amount - fee is 0.1% of send amount
  const sendAmount = parseFloat(amount) || 0;
  const feeAmount = sendAmount * FEE_PERCENTAGE;
  const totalAmount = sendAmount + feeAmount;

  const selectedBalance = useMemo(() => {
    return selectedAsset.balance || '0.00';
  }, [selectedAsset.balance]);

  const selectedBalanceValue = useMemo(() => Number(selectedBalance || '0'), [selectedBalance]);
  const hasSelectedBalance = selectedBalanceValue > 0;

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
      const positiveAsset = nextAssets.find((asset) => Number(asset.balance || '0') > 0);

      if (next && Number(next.balance || '0') > 0) {
        return next;
      }

      return positiveAsset || nextAssets[0];
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
    if (!recipientInfo.isValid || !amount || isSending || !hasSelectedBalance) return;

    if (parseFloat(amount) > selectedBalanceValue) return;

    setIsSending(true);
    setSendSuccess(false);

    try {
      const result = await executeInternalTransfer({
        recipient: recipientInfo.address,
        asset: selectedAsset.ticker,
        amount: Number(amount),
        memo: 'Dashboard send',
      });

      const txid = result?.transaction?.txid || result?.transaction?.id || 'unknown';
      const successAmount = amount.trim();
      setSendTxId(String(txid));
      const nextDetails = {
        amount: successAmount,
        ticker: selectedAsset.ticker,
        name: selectedAsset.name,
        logo: selectedAsset.logo,
      };
      setSentSuccessDetails(nextDetails);
      onSuccessDetailsChange?.(nextDetails);
      setSendSuccess(true);
      onSuccessPageChange?.(true);
      setAmount('');
      setRecipient('');
    } catch (error) {
      if (isTransactionCautionError(error)) {
        setCautionOpen(true);
        return;
      }
      console.error('Send transaction failed:', error);
      setSendSuccess(false);
      setSentSuccessDetails(null);
      onSuccessDetailsChange?.(null);
      onSuccessPageChange?.(false);
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

    const trimmedAddress = address.trim();
    const isAccountIdentifier = trimmedAddress.includes('@') || /^[A-Za-z0-9_-]{3,150}$/.test(trimmedAddress);
    const validationResult = isAccountIdentifier
      ? { isValid: trimmedAddress.length >= 3, isValidNetwork: true, error: undefined }
      : validateAddress(address, network);
    setRecipientInfo({
      isValid: validationResult.isValid,
      isValidNetwork: validationResult.isValidNetwork,
      address: address.trim(),
      error: validationResult.error,
    });
  };

  const successAmount = sentSuccessDetails?.amount ?? amount ?? '0';
  const successTicker = sentSuccessDetails?.ticker ?? selectedAsset.ticker;
  const successAssetName = sentSuccessDetails?.name ?? selectedAsset.name;

  const closeDesktopSuccess = () => {
    setSendSuccess(false);
    setSentSuccessDetails(null);
    onSuccessDetailsChange?.(null);
    onSuccessPageChange?.(false);
  };

  return (
    <>
      <CautionModal isOpen={cautionOpen} onClose={() => setCautionOpen(false)} />
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
        {!sendSuccess && (
          <button
            onClick={handleSubmit}
            disabled={!recipientInfo.isValid || !amount || isSending || !hasSelectedBalance || parseFloat(amount || '0') > selectedBalanceValue}
            className="w-full h-[50px] bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:bg-white/5 disabled:text-charcoalGray disabled:cursor-not-allowed transition-colors"
          >
            {isSending
              ? 'Sending...'
              : !hasSelectedBalance
                ? `Insufficient ${selectedAsset.ticker} balance`
                : `Send ${amount} ${selectedAsset.ticker}`}
          </button>
        )}
      </div>

      {/* Right Column: Summary + Tips + History */}
      <div className="hidden lg:block lg:col-span-1 min-w-0 space-y-6">
        {desktopSuccessDetails ? (
          <div className="min-h-[calc(100vh-180px)] flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/5 p-6 text-center">
            <img src={desktopSuccessDetails.logo} alt={desktopSuccessDetails.name} className="h-12 w-12 rounded-full border border-white/10 bg-white/5 shadow-lg shadow-primary/10" />
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white leading-none">
              {Number(desktopSuccessDetails.amount).toLocaleString(undefined, { maximumFractionDigits: 8 })} {desktopSuccessDetails.ticker} Sent
            </h2>
            <p className="mt-3 max-w-[260px] text-sm leading-5 text-charcoalGray">
              Your {desktopSuccessDetails.name} has been successfully sent.
            </p>
            <button type="button" onClick={closeDesktopSuccess} className="mt-8 w-full h-11 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors">
              OK
            </button>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
      </div>
    </>
  );
}
