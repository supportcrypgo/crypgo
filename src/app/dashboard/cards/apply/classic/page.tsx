'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

import BottomNav from '@/app/dashboard/components/BottomNav';
import DesktopHeader from '@/app/dashboard/components/DesktopHeader';
import DesktopSidebar, { SIDEBAR_OFFSET_CLASS } from '@/app/dashboard/components/DesktopSidebar';
import MobileHeader from '@/app/dashboard/components/MobileHeader';
import { FlippableCreditCard } from '@/components/ui/credit-debit-card';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cardApplicationsApi } from '@/data/api';

const benefits = [
  {
    number: '01',
    title: '$0 Monthly & Annual Fees',
    description: 'No hidden charges, zero monthly maintenance fees.',
  },
  {
    number: '02',
    title: 'Works Everywhere',
    description:
      'Instant crypto-to-USD conversion anywhere Visa® or Mastercard® is accepted at checkout, online, and at ATMs—including Amazon, Netflix, Uber, DoorDash, Target, and Apple.',
  },
  {
    number: '03',
    title: 'Global Compliance & Bank-Grade Security',
    description: 'FinCEN, VASP/MiCA, and FCA-compliant partners.',
  },
];

export default function CrypgoClassicPage() {
  const router = useRouter();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [isCreating, setIsCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  const startApplication = async () => {
    if (isCreating) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const application = await cardApplicationsApi.create();
      router.push(`/dashboard/cards/apply?application_id=${application.id}`);
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : 'Could not start a new application.',
      );
      setIsCreating(false);
    }
  };

  const content = (
    <main className="mx-auto w-full max-w-[760px] px-5 pb-28 pt-5 text-white sm:px-8 sm:pb-12 sm:pt-8">
      <section aria-label="Crypgo card preview" className="mx-auto w-full max-w-[520px]">
        <FlippableCreditCard
          frontOnly
          cvv="•••"
          showCardDetails={false}
        />
      </section>
      <section aria-label="Crypgo Classic benefits" className="mx-auto mt-6 max-w-[520px] space-y-5">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Crypgo Classic</h1>
          <p className="mt-1.5 text-lg leading-relaxed text-charcoalGray">
            One card connected to your crypto.
          </p>
        </header>
        <div className="space-y-4">
          {benefits.map(({ number, title, description }) => (
            <article key={number} className="flex gap-3">
              <span className="min-w-7 self-stretch pt-0.5 font-mono text-base leading-[1.6] text-primary">
                {number}
              </span>
              <div>
                <h2 className="text-sm font-semibold text-white">{title}</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-charcoalGray">
                  {description}
                </p>
              </div>
            </article>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void startApplication()}
          disabled={isCreating}
          className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-base font-medium text-darkmode transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-darkmode disabled:cursor-wait disabled:opacity-60"
        >
          Continue application
        </button>
        {createError && (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {createError}
          </p>
        )}
      </section>
    </main>
  );

  if (isDesktop) {
    return (
      <div className="min-h-screen bg-darkmode text-white">
        <DesktopSidebar />
        <div className={SIDEBAR_OFFSET_CLASS}>
          <DesktopHeader title="Crypgo Classic" backHref="/dashboard/cards" backLabel="Back to cards" />
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-darkmode text-white">
      <MobileHeader
        title="Crypgo Classic"
        onMenuClick={() => undefined}
        showMenuButton={false}
        showBackButton
        backHref="/dashboard/cards"
        backLabel="Back to cards"
      />
      {content}
      <BottomNav activeTab="cards" />
    </div>
  );
}
