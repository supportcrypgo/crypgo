'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock3, Plus } from 'lucide-react';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import BottomNav from '@/app/dashboard/components/BottomNav';
import DesktopHeader from '@/app/dashboard/components/DesktopHeader';
import DesktopSidebar, { SIDEBAR_OFFSET_CLASS } from '@/app/dashboard/components/DesktopSidebar';
import MobileHeader from '@/app/dashboard/components/MobileHeader';
import { FlippableCreditCard } from '@/components/ui/credit-debit-card';
import {
  ApiRequestError,
  CARD_APPLICATIONS_CHANGED_EVENT,
  cardApplicationsApi,
  type CardApplication,
} from '@/data/api';
import { SEND_ASSETS } from '@/data/assets';
import { getAssetIconPath } from '@/lib/assetIcons';
import ActivationSuccessScreen from './ActivationSuccessScreen';

function getCardApplicationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError && error.status >= 500) {
    return 'We could not complete your request right now. Please try again shortly.';
  }
  return error instanceof Error ? error.message : fallback;
}

function VirtualCardDisplay({ showCardDetails }: { showCardDetails: boolean }) {
  return (
    <FlippableCreditCard
      cvv="•••"
      frontOnly={!showCardDetails}
      showCardDetails={showCardDetails}
      className="mx-auto"
    />
  );
}

function PendingCardRow({
  application,
  onOpen,
}: {
  application: CardApplication;
  onOpen: () => void;
}) {
  const number = (application.card_number ?? '').replace(/(.{4})/g, '$1 ').trim();
  const sourceAsset = SEND_ASSETS.find((asset) => asset.ticker === application.source_asset);
  const [year, month] = application.expiry_date.split('-');
  const expiry = month && year ? `${month}/${year.slice(-2)}` : '';
  const isPending = application.status === 'activation_pending';
  const hasCard = isPending || application.status === 'approved';

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={hasCard ? 'View card application details' : 'Continue card application'}
      className="relative flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#0b101b] p-3 text-left transition hover:border-white/[0.16] hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-darkmode sm:gap-5 sm:p-5"
    >
      <div
        className="relative aspect-[1.586/1] w-[96px] shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[radial-gradient(ellipse_at_88%_4%,rgba(29,57,105,.2),transparent_38%),linear-gradient(135deg,#020611_0%,#09162c_48%,#040b18_100%)] shadow-xl shadow-black/20 sm:w-[150px] sm:rounded-xl"
        role="img"
        aria-label="Blank Crypgo card preview"
      >
        <span aria-hidden="true" className="absolute -right-12 -top-16 h-40 w-40 rounded-full border border-white/[0.08] sm:h-56 sm:w-56" />
        <span aria-hidden="true" className="absolute -right-5 -top-10 h-32 w-32 rounded-full border border-white/[0.07] sm:h-44 sm:w-44" />
      </div>

      <div className="min-w-0 flex-1">
        {sourceAsset && (
          <div className="flex items-center gap-2">
            <img
              src={getAssetIconPath(sourceAsset.ticker, sourceAsset.logo)}
              alt=""
              className="h-3 w-3 rounded-full"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">
                {sourceAsset.ticker}
              </span>
            </span>
          </div>
        )}
        {hasCard ? (
          <>
            <p className={`${sourceAsset ? 'mt-2' : 'mt-1'} whitespace-nowrap font-mono text-xs tracking-[0.04em] text-white sm:text-sm`}>
              {number}
            </p>
            <div className="mt-1 flex items-center gap-4 font-mono text-[11px] text-white/75 sm:text-xs">
              <span>{expiry}</span>
              <span>CVV&nbsp;***</span>
            </div>
          </>
        ) : null}
      </div>
      <span
        className={`absolute right-3 top-3 sm:right-4 sm:top-4 ${isPending ? 'text-amber-300' : 'text-emerald-300'}`}
        role="img"
        aria-label={isPending ? 'Pending' : 'Verified'}
        title={isPending ? 'Pending' : 'Verified'}
      >
        {isPending ? (
          <Clock3 className="h-4 w-4" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        )}
      </span>
    </button>
  );
}

export default function CardsPage() {
  const router = useRouter();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [applications, setApplications] = useState<CardApplication[]>([]);
  const [cardDetailsError, setCardDetailsError] = useState<string | null>(null);
  const [isLoadingCardDetails, setIsLoadingCardDetails] = useState(true);
  const [hasLoadedCardDetails, setHasLoadedCardDetails] = useState(false);
  const hasLoadedCardDetailsRef = React.useRef(false);
  const cardDetailsRequestInFlight = React.useRef(false);
  const [isStartingApplication, setIsStartingApplication] = useState(false);
  const [startApplicationError, setStartApplicationError] = useState<string | null>(null);

  const loadCardDetails = React.useCallback(async (showLoading = true) => {
    if (cardDetailsRequestInFlight.current) return;
    cardDetailsRequestInFlight.current = true;
    if (showLoading && !hasLoadedCardDetails) setIsLoadingCardDetails(true);
    try {
      const response = await cardApplicationsApi.list();
      setApplications(response.applications);
      hasLoadedCardDetailsRef.current = true;
      setHasLoadedCardDetails(true);
      setCardDetailsError(null);
    } catch {
      setCardDetailsError(hasLoadedCardDetailsRef.current
        ? 'Your card information could not be refreshed. The details shown may be out of date.'
        : 'We could not load your card information right now. Please try again shortly.');
    } finally {
      cardDetailsRequestInFlight.current = false;
      setIsLoadingCardDetails(false);
    }
  }, []);

  React.useEffect(() => {
    void loadCardDetails();
  }, [loadCardDetails]);

  React.useEffect(() => {
    const handleApplicationsChanged = () => {
      void loadCardDetails(false);
    };
    window.addEventListener(CARD_APPLICATIONS_CHANGED_EVENT, handleApplicationsChanged);
    return () => {
      window.removeEventListener(CARD_APPLICATIONS_CHANGED_EVENT, handleApplicationsChanged);
    };
  }, [loadCardDetails]);

  React.useEffect(() => {
    const refreshVisibleCards = () => {
      if (document.visibilityState === 'visible') {
        void loadCardDetails(false);
      }
    };
    const intervalId = window.setInterval(refreshVisibleCards, 30_000);
    document.addEventListener('visibilitychange', refreshVisibleCards);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshVisibleCards);
    };
  }, [loadCardDetails]);

  const cardApplications = applications.filter(
    (application) =>
      application.status === 'activation_pending' || application.status === 'approved',
  );
  const incompleteApplications = applications.filter(
    (application) => application.status === 'draft',
  );
  const activationNotice = applications.find(
    (application) =>
      application.status === 'approved' && application.approval_notice_pending,
  ) ?? null;
  const incompleteApplicationId = incompleteApplications[0]?.id ?? null;

  const startApplication = async () => {
    if (isStartingApplication) return;
    if (incompleteApplicationId !== null) {
      router.push(`/dashboard/cards/apply?application_id=${incompleteApplicationId}`);
      return;
    }
    setIsStartingApplication(true);
    setStartApplicationError(null);
    try {
      const application = await cardApplicationsApi.create();
      router.push(`/dashboard/cards/apply?application_id=${application.id}`);
    } catch (error) {
      setStartApplicationError(getCardApplicationErrorMessage(
        error,
        'Could not start a new application.',
      ));
      setIsStartingApplication(false);
    }
  };

  const viewApprovedCard = async () => {
    if (!activationNotice) return;
    await cardApplicationsApi.dismissApprovalNotice(activationNotice.id);
    setApplications((current) => current.map((application) =>
      application.id === activationNotice.id
        ? { ...application, approval_notice_pending: false }
        : application,
    ));
    router.push(`/dashboard/cards/details?application_id=${activationNotice.id}`);
  };

  const content = (
    <main className="px-4 pb-28 pt-4 text-white sm:px-6 lg:px-7 lg:pb-10 lg:pt-6">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-start gap-5">
        {hasLoadedCardDetails && cardDetailsError && (
          <p
            role="status"
            className="rounded-xl border border-amber-300/20 bg-amber-300/[0.04] px-4 py-3 text-sm text-amber-100/80"
          >
            {cardDetailsError}
          </p>
        )}
        {isLoadingCardDetails && !hasLoadedCardDetails ? (
          <section aria-live="polite" aria-busy="true" className="min-h-28" />
        ) : cardDetailsError && !hasLoadedCardDetails ? (
          <section role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/[0.04] px-5 py-6 text-center">
            <p className="text-sm text-red-300">
              We could not load your card information right now. Your application is safe. Please try again shortly.
            </p>
            <button
              type="button"
              onClick={() => void loadCardDetails()}
              className="mt-3 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Try again
            </button>
          </section>
        ) : cardApplications.length > 0 ? (
          <section className="space-y-5">
            <header className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
                  Crypgo Classic
                </p>
                <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  Your Cards
                </h1>
              </div>
              <button
                type="button"
                onClick={() => router.push('/dashboard/cards/apply/classic')}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-darkmode transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add
              </button>
            </header>
            <div className="space-y-3">
              {cardApplications.map((application) => (
                <PendingCardRow
                  key={application.id}
                  application={application}
                  onOpen={() => {
                    const path = application.status !== 'draft'
                      ? '/dashboard/cards/details'
                      : '/dashboard/cards/apply';
                    router.push(`${path}?application_id=${application.id}`);
                  }}
                />
              ))}
            </div>
          </section>
        ) : (
          <>
        <section className="mx-auto w-full max-w-[760px]">
            <VirtualCardDisplay showCardDetails={false} />

            <section aria-label="Crypgo Classic benefits" className="mx-auto mt-6 max-w-[520px] space-y-5">
              <header>
                <h2 className="text-3xl font-semibold tracking-tight text-white">Crypgo Classic</h2>
                <p className="mt-1.5 text-lg leading-relaxed text-charcoalGray">One card connected to your crypto.</p>
              </header>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <span className="min-w-7 self-stretch pt-0.5 font-mono text-base leading-[1.6] text-primary">01</span>
                  <div>
                    <h3 className="text-sm font-semibold text-white">$0 Monthly &amp; Annual Fees</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-charcoalGray">
                      No hidden charges, zero monthly maintenance fees.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="min-w-7 self-stretch pt-0.5 font-mono text-base leading-[1.6] text-primary">02</span>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Works Everywhere</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-charcoalGray">
                      Instant crypto-to-USD conversion anywhere Visa® or Mastercard® is accepted at checkout, online, and at ATMs—including Amazon, Netflix, Uber, DoorDash, Target, and Apple.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="min-w-7 self-stretch pt-0.5 font-mono text-base leading-[1.6] text-primary">03</span>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Global Compliance &amp; Bank-Grade Security</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-charcoalGray">
                      FinCEN, VASP/MiCA, and FCA-compliant partners.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <div className="mx-auto mt-8 max-w-[520px] sm:mt-5">
              <button
                type="button"
                onClick={() => void startApplication()}
                disabled={isStartingApplication}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-base font-medium text-darkmode transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
              >
                {isStartingApplication
                  ? 'Starting…'
                  : incompleteApplicationId !== null
                    ? 'Continue application'
                    : 'Continue'}
              </button>
              {startApplicationError && (
                <p role="alert" className="mt-3 text-center text-sm text-red-300">
                  {startApplicationError}
                </p>
              )}
            </div>
        </section>

          </>
        )}
      </div>
    </main>
  );

  if (isDesktop) {
    return (
      <div className="min-h-screen bg-darkmode text-white">
        <DesktopSidebar />
        <div className={SIDEBAR_OFFSET_CLASS}>
          <DesktopHeader title="Cards" />
          {activationNotice ? (
            <ActivationSuccessScreen
              application={activationNotice}
              onViewCard={viewApprovedCard}
            />
          ) : content}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-darkmode text-white">
      <MobileHeader
        title="Cards"
        onMenuClick={() => undefined}
        showMenuButton={false}
        showBackButton
        backHref="/dashboard"
        backLabel="Back to dashboard"
      />
      {activationNotice ? (
        <ActivationSuccessScreen
          application={activationNotice}
          onViewCard={viewApprovedCard}
        />
      ) : content}
      <BottomNav activeTab="cards" />
    </div>
  );
}
