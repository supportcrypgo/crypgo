'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Clock3 } from 'lucide-react';
import {
  CARD_ACTIVATION_PROCESSING_APPLICATION_ID_KEY,
  CARD_ACTIVATION_PROCESSING_TICKET_KEY,
  cardApplicationsApi,
  cardActivationCodeApi,
} from '@/data/api';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import MobileHeader from '@/app/dashboard/components/MobileHeader';
import BottomNav from '@/app/dashboard/components/BottomNav';
import DesktopSidebar, { SIDEBAR_OFFSET_CLASS } from '@/app/dashboard/components/DesktopSidebar';
import DesktopHeader from '@/app/dashboard/components/DesktopHeader';

export default function CardActivationProcessingPage() {
  const router = useRouter();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [approvalCheckError, setApprovalCheckError] = React.useState(false);

  React.useEffect(() => {
    let isCurrent = true;
    let pollTimer: number | undefined;

    const authorizePage = async () => {
      const ticket = window.sessionStorage.getItem(
        CARD_ACTIVATION_PROCESSING_TICKET_KEY,
      );
      const rawApplicationId = window.sessionStorage.getItem(
        CARD_ACTIVATION_PROCESSING_APPLICATION_ID_KEY,
      );
      const applicationId = Number(rawApplicationId);
      if (
        !ticket ||
        !Number.isSafeInteger(applicationId) ||
        applicationId <= 0
      ) {
        router.replace('/dashboard/cards');
        return;
      }

      try {
        await cardActivationCodeApi.authorizeProcessing(ticket);
        const checkApproval = async () => {
          if (!isCurrent) return;
          try {
            const application = await cardApplicationsApi.get(applicationId);
            if (!isCurrent) return;
            if (application.status === 'approved') {
              window.sessionStorage.removeItem(CARD_ACTIVATION_PROCESSING_TICKET_KEY);
              window.sessionStorage.removeItem(CARD_ACTIVATION_PROCESSING_APPLICATION_ID_KEY);
              router.replace('/dashboard/cards');
              return;
            }
            setApprovalCheckError(false);
          } catch {
            if (isCurrent) setApprovalCheckError(true);
          }
          if (isCurrent) {
            pollTimer = window.setTimeout(() => void checkApproval(), 10_000);
          }
        };
        await checkApproval();
      } catch {
        if (isCurrent) router.replace('/dashboard/cards');
      }
    };

    void authorizePage();
    return () => {
      isCurrent = false;
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
    };
  }, [router]);

  const cancel = () => {
    window.sessionStorage.removeItem(CARD_ACTIVATION_PROCESSING_TICKET_KEY);
    window.sessionStorage.removeItem(CARD_ACTIVATION_PROCESSING_APPLICATION_ID_KEY);
    router.push('/dashboard/cards');
  };

  const content = (
    <main className="flex min-h-[calc(100vh-140px)] items-center justify-center bg-darkmode px-6 py-12 text-white lg:min-h-[calc(100vh-72px)]">
      <section
        className="w-full max-w-md text-center"
        aria-live="polite"
        aria-busy="true"
      >
        <div
          className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-full border border-amber-400/25 bg-amber-400/10 text-amber-300"
          role="img"
          aria-label="Request pending"
        >
          <Clock3 className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Processing your request
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-charcoalGray">
          In some cases, this may take up to 2–3 days or even longer, depending on the volume of requests.
        </p>
        {approvalCheckError && (
          <p role="status" className="mt-3 text-sm leading-relaxed text-amber-200/80">
            We could not check your application status just now. We’ll try again automatically.
          </p>
        )}
        <button
          type="button"
          onClick={cancel}
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-7 text-sm font-medium text-white transition hover:border-white/35 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-darkmode"
        >
          I'll wait
        </button>
      </section>
    </main>
  );

  if (isDesktop) {
    return (
      <div className="min-h-screen bg-darkmode text-white">
        <DesktopSidebar />
        <div className={SIDEBAR_OFFSET_CLASS}>
          <DesktopHeader title="Activate card" />
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-darkmode text-white">
      <MobileHeader
        title="Activate card"
        onMenuClick={() => undefined}
        showMenuButton={false}
      />
      {content}
      <BottomNav activeTab="cards" />
    </div>
  );
}
