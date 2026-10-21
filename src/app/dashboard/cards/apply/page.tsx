'use client';

import React from 'react';
import Link from 'next/link';
import { Check, ChevronDown, ChevronRight, Search, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  ApiRequestError,
  cardApplicationsApi,
  cardDeliveryAddressApi,
  cardIssuerApi,
  type CardDeliveryAddress,
} from '@/data/api';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useUnified } from '@/context/UnifiedContext';
import { getAssetIconPath } from '@/lib/assetIcons';
import { aggregateWalletAmountsByTicker } from '@/lib/walletBalances';
import { SEND_ASSETS } from '@/data/assets';
import { FlippableCreditCard } from '@/components/ui/credit-debit-card';
import MobileHeader from '@/app/dashboard/components/MobileHeader';
import BottomNav from '@/app/dashboard/components/BottomNav';
import DesktopSidebar, { SIDEBAR_OFFSET_CLASS } from '@/app/dashboard/components/DesktopSidebar';
import DesktopHeader from '@/app/dashboard/components/DesktopHeader';

const countryCodes =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
export default function CardApplicationPage() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const router = useRouter();
  const { walletAssets, isLoading: walletIsLoading } = useUnified();
  const [selectedAssetId, setSelectedAssetId] = React.useState<string | null>(null);
  const [assetMenuOpen, setAssetMenuOpen] = React.useState(false);
  const [assetSearch, setAssetSearch] = React.useState('');
  const [termsAccepted, setTermsAccepted] = React.useState(false);
  const [deliveryAddress, setDeliveryAddress] = React.useState<CardDeliveryAddress | null>(null);
  const [deliveryAddressError, setDeliveryAddressError] = React.useState<string | null>(null);
  const [applicationError, setApplicationError] = React.useState<string | null>(null);
  const [isSubmittingApplication, setIsSubmittingApplication] = React.useState(false);
  const [isDeletingApplication, setIsDeletingApplication] = React.useState(false);
  const [deleteApplicationError, setDeleteApplicationError] = React.useState<string | null>(null);
  const [applicationId, setApplicationId] = React.useState<number | null>(null);
  const [isResolvingApplication, setIsResolvingApplication] = React.useState(true);
  const [availableSourceAssets, setAvailableSourceAssets] = React.useState<string[]>([]);

  React.useEffect(() => {
    document.documentElement.classList.add('page-scrollbar-hide');
    document.body.classList.add('page-scrollbar-hide');

    return () => {
      document.documentElement.classList.remove('page-scrollbar-hide');
      document.body.classList.remove('page-scrollbar-hide');
    };
  }, []);

  React.useEffect(() => {
    let isMounted = true;
    const requestedId = new URLSearchParams(window.location.search).get('application_id');

    if (requestedId !== null) {
      const parsedId = Number(requestedId);
      if (!Number.isSafeInteger(parsedId) || parsedId <= 0) {
        setApplicationError('This card application link is invalid.');
        setIsResolvingApplication(false);
      } else {
        setApplicationId(parsedId);
        setIsResolvingApplication(false);
      }
      return () => {
        isMounted = false;
      };
    }

    cardApplicationsApi.list()
      .then(({ applications }) => {
        if (!isMounted) return;
        const drafts = applications.filter((application) => application.status === 'draft');
        if (drafts.length !== 1) {
          setApplicationError('Start a new card application from the Crypgo Classic page.');
          return;
        }
        setApplicationId(drafts[0].id);
        router.replace(`/dashboard/cards/apply?application_id=${drafts[0].id}`);
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setApplicationError(
            error instanceof Error ? error.message : 'Could not load your card application.',
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsResolvingApplication(false);
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  React.useEffect(() => {
    if (applicationId === null) return;
    let isMounted = true;
    Promise.all([
      cardDeliveryAddressApi.get(applicationId),
      cardApplicationsApi.get(applicationId),
      cardApplicationsApi.list(),
    ])
      .then(([addressResponse, application, applicationList]) => {
        if (!isMounted) return;
        setDeliveryAddress(addressResponse.address);
        const available = new Set(applicationList.available_source_assets);
        if (application.source_asset) available.add(application.source_asset);
        setAvailableSourceAssets(Array.from(available));
        if (application.source_asset) setSelectedAssetId(application.source_asset);
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setDeliveryAddressError(
            error instanceof Error
              ? error.message
              : 'Could not load your card application details.',
          );
        }
      });

    return () => {
      isMounted = false;
    };
  }, [applicationId]);

  const countryName = deliveryAddress?.country
    ? new Intl.DisplayNames(['en'], { type: 'region' }).of(deliveryAddress.country)
    : null;
  const addressLines = deliveryAddress
    ? [
        [deliveryAddress.secondary_unit, deliveryAddress.street_address].filter(Boolean).join(', '),
        [deliveryAddress.city, deliveryAddress.state, deliveryAddress.zip_code].filter(Boolean).join(', '),
        countryName,
      ].filter(Boolean)
    : [];
  const hasDeliveryAddress = addressLines.length > 0;
  const availableAssets = React.useMemo(() => {
    const balances = aggregateWalletAmountsByTicker(walletAssets, 'availableQuantity');
    return SEND_ASSETS.filter((asset) => availableSourceAssets.includes(asset.ticker)).map((asset) => ({
      id: asset.ticker,
      name: asset.name,
      ticker: asset.ticker,
      logo: asset.logo,
      availableQuantity: balances[asset.ticker] ?? 0,
    }));
  }, [availableSourceAssets, walletAssets]);
  const selectedAsset =
    availableAssets.find((asset) => asset.id === selectedAssetId) ??
    availableAssets.find((asset) => asset.availableQuantity > 0) ??
    availableAssets[0] ??
    null;
  const filteredAssets = availableAssets.filter((asset) =>
    `${asset.ticker} ${asset.name}`.toLowerCase().includes(assetSearch.trim().toLowerCase())
  );
  const submitApplication = async () => {
    if (!selectedAsset || isSubmittingApplication) {
      setApplicationError('Choose a source asset before continuing.');
      return;
    }

    setApplicationError(null);
    setIsSubmittingApplication(true);
    try {
      if (applicationId === null) {
        throw new Error('The card application is not ready yet. Please try again.');
      }
      await cardIssuerApi.saveSourceAsset(selectedAsset.ticker, applicationId);
      router.push(`/dashboard/cards/activate?application_id=${applicationId}`);
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.code === 'CARD_APPLICATION_ALREADY_PENDING'
      ) {
        toast.error('You already have a pending card application. Choose a different asset.');
        router.replace('/dashboard/cards');
        return;
      }
      setApplicationError(
        error instanceof Error ? error.message : 'Could not save your selected source asset.',
      );
    } finally {
      setIsSubmittingApplication(false);
    }
  };
  const deleteApplication = async () => {
    if (applicationId === null || isDeletingApplication) return;
    const confirmed = window.confirm(
      'Delete this incomplete card application? This cannot be undone.',
    );
    if (!confirmed) return;

    setIsDeletingApplication(true);
    setDeleteApplicationError(null);
    try {
      await cardApplicationsApi.delete(applicationId);
      router.replace('/dashboard/cards');
    } catch (error) {
      setDeleteApplicationError(
        error instanceof Error ? error.message : 'Could not delete your card application.',
      );
      setIsDeletingApplication(false);
    }
  };
  const content = (
    <>
    <main className="mx-auto w-full max-w-[760px] px-5 pb-28 pt-5 text-white sm:px-8 sm:pb-12 sm:pt-8">
      <section aria-label="Card preview" className="mx-auto w-full max-w-[520px]">
        <FlippableCreditCard
          frontOnly
          cvv="•••"
          applicationId={applicationId ?? undefined}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-white">Choose Asset</h2>
        <div className="relative mt-3">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={assetMenuOpen}
            onClick={() => setAssetMenuOpen((open) => !open)}
            className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3.5 text-left transition hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {selectedAsset ? (
              <>
                <img
                  src={getAssetIconPath(selectedAsset.ticker, selectedAsset.logo)}
                  alt=""
                  className="h-9 w-9 rounded-full"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{selectedAsset.ticker}</span>
                  <span className="block truncate text-xs text-charcoalGray">{selectedAsset.name}</span>
                </span>
                <span className="text-right">
                  <span className="block text-[11px] text-charcoalGray">Available balance</span>
                  <span className="block whitespace-nowrap text-sm font-medium text-white">
                    {selectedAsset.availableQuantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                  </span>
                </span>
              </>
            ) : (
              <span className="min-w-0 flex-1 text-sm text-charcoalGray">
                {walletIsLoading ? '' : 'No assets available'}
              </span>
            )}
            <ChevronDown
              aria-hidden="true"
              className={`h-4 w-4 shrink-0 text-charcoalGray transition-transform ${assetMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {assetMenuOpen && (
            <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#101827] shadow-2xl shadow-black/40">
              <div className="border-b border-white/10 p-3">
                <div className="relative">
                  <Search
                    aria-hidden="true"
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoalGray"
                  />
                  <input
                    type="search"
                    value={assetSearch}
                    onChange={(event) => setAssetSearch(event.target.value)}
                    placeholder="Search assets..."
                    aria-label="Search assets"
                    className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] pl-9 pr-3 text-sm text-white outline-none placeholder:text-charcoalGray focus:border-primary/50"
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {filteredAssets.length > 0 ? (
                  filteredAssets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      role="option"
                      aria-selected={selectedAsset?.id === asset.id}
                      onClick={() => {
                        setSelectedAssetId(asset.id);
                        setAssetMenuOpen(false);
                        setAssetSearch('');
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.06] focus-visible:bg-white/[0.06] focus-visible:outline-none"
                    >
                      <img
                        src={getAssetIconPath(asset.ticker, asset.logo)}
                        alt=""
                        className="h-8 w-8 rounded-full"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white">{asset.ticker}</span>
                        <span className="block truncate text-xs text-charcoalGray">{asset.name}</span>
                      </span>
                      <span className="text-right">
                        <span className="block text-[10px] text-charcoalGray">Available</span>
                        <span className="block text-sm text-white">
                          {asset.availableQuantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                        </span>
                      </span>
                      {selectedAsset?.id === asset.id && (
                        <Check aria-hidden="true" className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  ))
                ) : (
                  <p className="px-4 py-6 text-center text-sm text-charcoalGray">
                    {availableAssets.length === 0 ? 'No assets available' : 'No matching assets'}
                  </p>
                )}
              </div>
            </div>
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
          <p className="mt-1.5 text-sm text-charcoalGray">Use physical address, no P. O. Box.</p>
          {deliveryAddressError && (
            <p role="alert" className="mt-3 text-sm leading-relaxed text-red-300">
              {deliveryAddressError}
            </p>
          )}
          <Link
            href={applicationId === null ? '#' : `/dashboard/cards/apply/delivery-details?application_id=${applicationId}`}
            aria-disabled={applicationId === null}
            onClick={(event) => {
              if (applicationId === null) event.preventDefault();
            }}
            className={`mt-5 flex min-h-[60px] items-center justify-between rounded-xl border border-white/10 bg-white/[0.035] px-4 py-4 text-sm font-medium transition hover:border-primary/30 hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              hasDeliveryAddress ? 'text-white' : 'text-charcoalGray hover:text-white'
            }`}
          >
            <span className="min-w-0 flex-1">
              {hasDeliveryAddress ? (
                <span className="block space-y-2">
                  {addressLines.map((line) => (
                    <span key={line} className="block break-words leading-relaxed text-white">
                      {line}
                    </span>
                  ))}
                </span>
              ) : (
                'Delivery address'
              )}
            </span>
            <ChevronRight aria-hidden="true" className="h-5 w-5 text-charcoalGray" />
          </Link>
          {applicationError && (
            <p role="alert" className="mt-3 text-sm text-red-300">
              {applicationError}
            </p>
          )}
          <div className="mt-6 flex items-start gap-3 text-sm leading-relaxed text-charcoalGray">
            <input
              id="card-terms-accepted"
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-emerald-400"
            />
            <div>
              <label htmlFor="card-terms-accepted" className="cursor-pointer">
                Click the button below to accept{' '}
              </label>
              <button
                type="button"
                onClick={(event) => event.preventDefault()}
                className="font-medium text-emerald-300 underline decoration-emerald-300/50 underline-offset-2 transition hover:text-emerald-200"
              >
                Terms &amp; Conditions
              </button>
            </div>
          </div>
          {hasDeliveryAddress ? (
            <button
              type="button"
              onClick={() => void submitApplication()}
              disabled={isResolvingApplication || applicationId === null || isSubmittingApplication || !selectedAsset}
              className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-base font-medium text-darkmode transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-darkmode disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirm
            </button>
          ) : (
            <Link
              href={applicationId === null ? '#' : `/dashboard/cards/apply/delivery-details?application_id=${applicationId}`}
              aria-disabled={applicationId === null}
              onClick={(event) => {
                if (applicationId === null) event.preventDefault();
              }}
              className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-base font-medium text-darkmode transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-darkmode aria-disabled:cursor-wait aria-disabled:opacity-50"
            >
              Enter Address to Apply
            </Link>
          )}
          {deleteApplicationError && (
            <p role="alert" className="mt-3 text-sm text-red-300">
              {deleteApplicationError}
            </p>
          )}
          <button
            type="button"
            onClick={() => void deleteApplication()}
            disabled={applicationId === null || isResolvingApplication || isDeletingApplication}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-400/25 px-5 text-sm font-medium text-red-300 transition hover:border-red-400/50 hover:bg-red-400/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            {isDeletingApplication ? 'Deleting application…' : 'Delete application'}
          </button>
        </div>
      </section>
    </main>
    </>
  );

  if (isDesktop) {
    return (
      <div className="min-h-screen bg-darkmode text-white">
        <DesktopSidebar />
        <div className={SIDEBAR_OFFSET_CLASS}>
          <DesktopHeader
            title="Card Application"
            backHref="/dashboard/cards"
            backLabel="Back to cards"
          />
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-darkmode text-white">
      <MobileHeader
        title="Card Application"
        onMenuClick={() => undefined}
        showMenuButton={false}
        showBackButton
        onBackClick={() => router.replace('/dashboard/cards')}
        backLabel="Back to cards"
      />
      {content}
      <BottomNav activeTab="cards" />
    </div>
  );
}
