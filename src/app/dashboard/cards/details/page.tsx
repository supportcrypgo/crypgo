'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  Check,
  Delete,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';

import BottomNav from '@/app/dashboard/components/BottomNav';
import { useCardDeliveryAddress } from '@/app/dashboard/components/CardDeliveryAddressProvider';
import DesktopHeader from '@/app/dashboard/components/DesktopHeader';
import DesktopSidebar, { SIDEBAR_OFFSET_CLASS } from '@/app/dashboard/components/DesktopSidebar';
import MobileHeader from '@/app/dashboard/components/MobileHeader';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useUnified } from '@/context/UnifiedContext';
import {
  cardDeliveryAddressApi,
  cardApplicationsApi,
  type CardDeliveryAddress,
  type CardApplication,
} from '@/data/api';
import { aggregateWalletAmountsByTicker } from '@/lib/walletBalances';
import { SEND_ASSETS } from '@/data/assets';
import { getAssetIconPath } from '@/lib/assetIcons';
import { FlippableCreditCard } from '@/components/ui/credit-debit-card';
import { useDisplayCurrency } from '@/context/DisplayCurrencyContext';
import PinActionLoadingOverlay from '@/app/dashboard/cards/components/PinActionLoadingOverlay';
import CurrencyValue from '@/app/dashboard/components/CurrencyValue';
import CurrencyLoadingShimmer from '@/app/dashboard/components/CurrencyLoadingShimmer';

export default function CardDetailsPage() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const router = useRouter();
  const { refresh: refreshDeliveryAddress } = useCardDeliveryAddress();
  const { walletAssets } = useUnified();
  const { formatFromUsd, convertFromUsd } = useDisplayCurrency();
  const [isCardBlocked, setIsCardBlocked] = React.useState(false);
  const [isBalanceHidden, setIsBalanceHidden] = React.useState(false);
  const [isRetrievePinOpen, setIsRetrievePinOpen] = React.useState(false);
  const [isRetrievingPin, setIsRetrievingPin] = React.useState(false);
  const [retrievePinEntry, setRetrievePinEntry] = React.useState('');
  const [visiblePinDigitIndex, setVisiblePinDigitIndex] = React.useState<number | null>(null);
  const [card, setCard] = React.useState<CardApplication | null>(null);
  const [applicationId, setApplicationId] = React.useState<number | null>(null);
  const [address, setAddress] = React.useState<CardDeliveryAddress | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    if (!isRetrievePinOpen || isRetrievingPin) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsRetrievePinOpen(false);
        setRetrievePinEntry('');
      } else if (/^\d$/.test(event.key)) {
        setRetrievePinEntry((entry) => (entry.length < 4 ? `${entry}${event.key}` : entry));
      } else if (event.key === 'Backspace') {
        setRetrievePinEntry((entry) => entry.slice(0, -1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRetrievePinOpen, isRetrievingPin]);

  React.useEffect(() => {
    if (!isRetrievePinOpen || retrievePinEntry.length !== 4) return;

    setIsRetrievingPin(true);
    const timeout = window.setTimeout(() => {
      setIsRetrievePinOpen(false);
      setRetrievePinEntry('');
      setIsRetrievingPin(false);
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [isRetrievePinOpen, retrievePinEntry]);

  React.useEffect(() => {
    if (!isRetrievePinOpen || retrievePinEntry.length === 0) {
      setVisiblePinDigitIndex(null);
      return;
    }

    const digitIndex = retrievePinEntry.length - 1;
    setVisiblePinDigitIndex(digitIndex);
    const timeout = window.setTimeout(() => setVisiblePinDigitIndex(null), 700);
    return () => window.clearTimeout(timeout);
  }, [isRetrievePinOpen, retrievePinEntry]);

  React.useEffect(() => {
    if (!isRetrievePinOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isRetrievePinOpen]);

  const closeRetrievePin = () => {
    if (isRetrievingPin) return;
    setIsRetrievePinOpen(false);
    setRetrievePinEntry('');
  };

  const loadDetails = React.useCallback(async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const [cardDetails, addressDetails] = await Promise.all([
        cardApplicationsApi.get(id),
        cardDeliveryAddressApi.get(id),
      ]);
      setCard(cardDetails);
      setAddress(addressDetails.address);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load your card application details.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let isMounted = true;
    const resolveApplication = async () => {
      try {
        const requestedId = new URLSearchParams(window.location.search).get('application_id');
        let resolvedId: number;
        if (requestedId !== null) {
          resolvedId = Number(requestedId);
          if (!Number.isSafeInteger(resolvedId) || resolvedId <= 0) {
            throw new Error('This card application link is invalid.');
          }
        } else {
          const { applications } = await cardApplicationsApi.list();
          if (applications.length !== 1) {
            throw new Error('Choose a card application to view its details.');
          }
          resolvedId = applications[0].id;
        }
        if (!isMounted) return;
        setApplicationId(resolvedId);
        await loadDetails(resolvedId);
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load your card application details.',
          );
          setIsLoading(false);
        }
      }
    };
    void resolveApplication();
    return () => {
      isMounted = false;
    };
  }, [loadDetails]);

  const selectedAsset = card
    ? SEND_ASSETS.find((asset) => asset.ticker === card.source_asset)
    : undefined;
  const assetBalances = aggregateWalletAmountsByTicker(walletAssets, 'availableQuantity');
  const assetQuantities = aggregateWalletAmountsByTicker(walletAssets, 'quantity');
  const selectedWalletAssets = selectedAsset
    ? walletAssets.filter((asset) => asset.ticker === selectedAsset.ticker)
    : [];
  const hasSelectedAssetUsdPrice =
    selectedWalletAssets.length > 0 &&
    selectedWalletAssets.every((asset) => Number.isFinite(asset.price) && asset.price > 0);
  const selectedAssetAvailableUsd = selectedWalletAssets.reduce(
    (total, asset) => total + asset.availableQuantity * asset.price,
    0,
  );
  const countryName = address?.country
    ? new Intl.DisplayNames(['en'], { type: 'region' }).of(address.country)
    : null;
  const addressLines = address
    ? [
        [address.secondary_unit, address.street_address].filter(Boolean).join(', '),
        [address.city, address.state, address.zip_code].filter(Boolean).join(', '),
        countryName,
      ].filter(Boolean)
    : [];
  const deleteApplication = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this application? This action cannot be undone.',
    );
    if (!confirmed || isDeleting) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      if (applicationId === null) {
        throw new Error('The card application could not be identified. Please reload and try again.');
      }
      await cardApplicationsApi.delete(applicationId);
      await refreshDeliveryAddress();
      router.replace('/dashboard/cards');
    } catch (deleteRequestError) {
      setDeleteError(
        deleteRequestError instanceof Error
          ? deleteRequestError.message
          : 'Could not delete your card application. Please try again.',
      );
      setIsDeleting(false);
    }
  };

  const content = (
    <main className="mx-auto w-full max-w-[760px] px-5 pb-28 pt-5 text-white sm:px-8 sm:pb-12 sm:pt-8 lg:max-w-[1000px] lg:px-10 xl:max-w-[1240px]">
      {isLoading ? (
        <div aria-live="polite" aria-busy="true" />
      ) : error ? (
        <section
          role="alert"
          className="rounded-2xl border border-red-400/20 bg-red-400/[0.04] px-5 py-6 text-center"
        >
          <p className="text-sm text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => applicationId !== null && void loadDetails(applicationId)}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        </section>
      ) : card?.status === 'approved' ? (
        <section
          aria-label="Your approved card"
          className="mx-auto w-full max-w-[520px] xl:grid xl:max-w-none xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] xl:items-start xl:gap-12"
        >
          <FlippableCreditCard frontOnly cvv="•••" applicationId={card.id} />
          <div aria-label="Card controls" className="mt-7 space-y-6 xl:mt-0">
            {selectedAsset && (
              <div className="flex items-center gap-4">
                <img
                  src={getAssetIconPath(selectedAsset.ticker, selectedAsset.logo)}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-full"
                />
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <div>
                    <p className="text-4xl font-bold tracking-tight text-white">
                      {isBalanceHidden
                        ? '••••••'
                        : (assetQuantities[selectedAsset.ticker] ?? 0).toLocaleString(undefined, {
                            maximumFractionDigits: 6,
                          })}
                    </p>
                    <p className="mt-1 text-sm text-charcoalGray">
                      Available:{' '}
                      {isBalanceHidden
                        ? '••••••'
                        : hasSelectedAssetUsdPrice
                          ? convertFromUsd(selectedAssetAvailableUsd) === null
                            ? <CurrencyLoadingShimmer className="h-3.5 w-24" />
                            : formatFromUsd(selectedAssetAvailableUsd)
                          : 'Fiat value unavailable'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBalanceHidden((hidden) => !hidden)}
                    aria-label={isBalanceHidden ? 'Show balance' : 'Hide balance'}
                    aria-pressed={isBalanceHidden}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-charcoalGray transition-colors hover:bg-white/5 hover:text-white"
                  >
                    {isBalanceHidden ? (
                      <EyeOff className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Eye className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            )}
            <section aria-labelledby="card-management-title" className="mt-10 pt-2">
              <header>
                <h2
                  id="card-management-title"
                  className="text-xs font-medium uppercase tracking-wider text-charcoalGray sm:text-sm sm:font-semibold"
                >
                  Card Management
                </h2>
              </header>
              <div className="mt-2 flex min-h-[76px] items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-base font-medium text-white">Block card</span>
                  <span className="mt-0.5 text-xs text-charcoalGray">Active</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-label="Block card"
                  aria-checked={isCardBlocked}
                  onClick={() => setIsCardBlocked((blocked) => !blocked)}
                  className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border border-white/10 transition-colors ${
                    isCardBlocked ? 'bg-primary' : 'bg-white/10'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 rounded-full bg-white transition-transform ${
                      isCardBlocked ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {['Change PIN', 'Retrieve PIN', 'Activate PIN'].map((action) => {
                const row = (
                  <>
                    <span className="text-base font-medium text-white">{action}</span>
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-charcoalGray"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </span>
                  </>
                );

                return action === 'Change PIN' || action === 'Activate PIN' ? (
                  <Link
                    key={action}
                    href={`/dashboard/cards/${action === 'Change PIN' ? 'change-pin' : 'activate-pin'}?application_id=${card.id}`}
                    className="flex min-h-[76px] items-center justify-between"
                  >
                    {row}
                  </Link>
                ) : action === 'Retrieve PIN' ? (
                  <button
                    key={action}
                    type="button"
                    onClick={() => {
                      setRetrievePinEntry('');
                      setIsRetrievePinOpen(true);
                    }}
                    className="flex min-h-[76px] w-full items-center justify-between text-left"
                  >
                    {row}
                  </button>
                ) : (
                  <div
                    key={action}
                    className="flex min-h-[76px] items-center justify-between"
                  >
                    {row}
                  </div>
                );
              })}
            </section>
          </div>
        </section>
      ) : (
        <>
          <section aria-label="Card preview" className="mx-auto w-full max-w-[520px]">
            <FlippableCreditCard frontOnly cvv="•••" applicationId={card?.id} />
          </section>

          <section className="mt-8">
            <h2 className="text-base font-semibold text-white">Choose Asset</h2>
            <div
              aria-label="Selected source asset"
              className="mt-3 flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3.5"
            >
              {selectedAsset ? (
                <>
                  <img
                    src={getAssetIconPath(selectedAsset.ticker, selectedAsset.logo)}
                    alt=""
                    className="h-9 w-9 rounded-full"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">
                      {selectedAsset.ticker}
                    </span>
                    <span className="block truncate text-xs text-charcoalGray">
                      {selectedAsset.name}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[11px] text-charcoalGray">Available balance</span>
                    <span className="block whitespace-nowrap text-sm font-medium text-white">
                      {(assetBalances[selectedAsset.ticker] ?? 0).toLocaleString(undefined, {
                        maximumFractionDigits: 6,
                      })}
                    </span>
                  </span>
                </>
              ) : (
                <span className="text-sm text-charcoalGray">No source asset was saved</span>
              )}
            </div>
          </section>

          <section className="mt-9">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              Card Receipt
            </p>

            <div className="mt-5">
              <h2 className="text-base font-semibold text-white">Collection method</h2>
              <div className="relative mt-3 inline-flex min-h-0 items-center rounded-xl border border-emerald-400/25 bg-emerald-400/[0.07] py-4 pl-5 pr-12">
                <p className="text-base font-semibold text-emerald-300">Home Delivery</p>
                <Check
                  aria-hidden="true"
                  className="absolute bottom-0 right-0 h-6 w-6 rounded-tl-lg bg-emerald-500 p-1 text-white"
                  strokeWidth={2.5}
                />
              </div>
            </div>

            <div className="mt-8 border-t border-white/10 pt-7">
              <h2 className="text-base font-semibold text-white">Delivery Address</h2>
              <p className="mt-1.5 text-sm text-charcoalGray">
                Use physical address, no P. O. Box.
              </p>
              <div
                aria-label="Saved delivery address"
                className={`mt-5 flex min-h-[60px] items-center rounded-xl border border-white/10 bg-white/[0.035] px-4 py-4 text-sm font-medium ${
                  addressLines.length ? 'text-white' : 'text-charcoalGray'
                }`}
              >
                {addressLines.length ? (
                  <span className="block min-w-0 flex-1 space-y-2">
                    {addressLines.map((line) => (
                      <span key={line} className="block break-words leading-relaxed text-white">
                        {line}
                      </span>
                    ))}
                  </span>
                ) : (
                  'No saved delivery address'
                )}
              </div>
            </div>
          </section>

          <section className="border-t border-white/[0.08] pt-6">
            {deleteError && (
                <p role="alert" className="mt-3 text-sm text-red-300">
                  {deleteError}
                </p>
            )}
            <button
                type="button"
                onClick={() => void deleteApplication()}
                disabled={isDeleting}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-400/25 bg-red-400/[0.06] px-5 text-sm font-semibold text-red-300 transition hover:border-red-400/45 hover:bg-red-400/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
            >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {isDeleting ? 'Deleting application…' : 'Delete application'}
            </button>
          </section>
        </>
      )}
    </main>
  );

  const retrievePinModal = isRetrievePinOpen ? (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-[2px] lg:items-center lg:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeRetrievePin();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="retrieve-pin-title"
        className="w-full max-w-md rounded-t-2xl border border-white/10 bg-[#101722] px-5 pb-8 pt-6 shadow-2xl shadow-black/40 lg:rounded-2xl"
      >
        <header className="relative flex items-center justify-center">
          <h2 id="retrieve-pin-title" className="text-lg font-semibold text-white text-center">
            Enter Pin
          </h2>
          <button
            type="button"
            onClick={closeRetrievePin}
            disabled={isRetrievingPin}
            aria-label="Close Enter Pin"
            className="absolute right-0 flex h-9 w-9 items-center justify-center rounded-full text-charcoalGray transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div
          aria-label={`${retrievePinEntry.length} of 4 PIN digits entered`}
          className="mt-8 flex justify-center gap-4"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <span
              key={index}
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold text-white ${
                index < retrievePinEntry.length
                  ? 'border-primary/70 bg-primary/15'
                  : 'border-white/20 bg-white/[0.03]'
              }`}
            >
              {index < retrievePinEntry.length
                ? index === visiblePinDigitIndex
                  ? retrievePinEntry[index]
                  : '•'
                : ''}
            </span>
          ))}
        </div>

        <div className="mx-auto mt-8 grid max-w-[280px] grid-cols-3 gap-x-6 gap-y-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'].map(
            (key, index) =>
              key === '' ? (
                <span key={`empty-${index}`} aria-hidden="true" />
              ) : key === 'delete' ? (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRetrievePinEntry((entry) => entry.slice(0, -1))}
                  disabled={isRetrievingPin}
                  aria-label="Delete last digit"
                  className="flex h-14 items-center justify-center rounded-xl text-charcoalGray transition-colors hover:bg-white/5 hover:text-white active:bg-white/10"
                >
                  <Delete className="h-6 w-6" aria-hidden="true" />
                </button>
              ) : (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setRetrievePinEntry((entry) => (entry.length < 4 ? `${entry}${key}` : entry))
                  }
                  disabled={isRetrievingPin}
                  className="flex h-14 items-center justify-center rounded-xl text-2xl font-medium text-white transition-colors hover:bg-white/5 active:bg-white/10"
                >
                  {key}
                </button>
              ),
          )}
        </div>
      </section>
    </div>
  ) : null;

  if (isDesktop) {
    return (
      <div className="min-h-screen bg-darkmode text-white">
        <DesktopSidebar />
        <div className={SIDEBAR_OFFSET_CLASS}>
          <DesktopHeader
            title={card?.status === 'approved' ? 'Your Card' : 'Card Application'}
            backHref="/dashboard/cards"
            backLabel="Back to cards"
          />
          {content}
        </div>
        {retrievePinModal}
        {isRetrievingPin && <PinActionLoadingOverlay />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-darkmode text-white">
      <MobileHeader
        title={card?.status === 'approved' ? 'Your Card' : 'Card Application'}
        onMenuClick={() => undefined}
        showMenuButton={false}
        showBackButton
        backHref="/dashboard/cards"
        backLabel="Back to cards"
      />
      {content}
      <BottomNav activeTab="cards" />
      {retrievePinModal}
      {isRetrievingPin && <PinActionLoadingOverlay />}
    </div>
  );
}
