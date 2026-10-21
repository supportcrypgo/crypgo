'use client';

import React from 'react';

import { FlippableCreditCard } from '@/components/ui/credit-debit-card';
import type { CardApplication } from '@/data/api';

interface ActivationSuccessScreenProps {
  application: CardApplication;
  onViewCard: () => Promise<void>;
}

export default function ActivationSuccessScreen({
  application,
  onViewCard,
}: ActivationSuccessScreenProps) {
  const [isWorking, setIsWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const runAction = async (action: () => Promise<void>) => {
    if (isWorking) return;
    setIsWorking(true);
    setError(null);
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error
        ? actionError.message
        : 'Could not update your card status. Please try again.');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <main
      aria-labelledby="card-ready-title"
      className="bg-[#030B17] text-white"
    >
      <section className="mx-auto flex min-h-[calc(100svh-140px)] w-full max-w-[1000px] flex-col items-center justify-center gap-8 px-6 py-8 sm:gap-10 md:flex-row md:gap-12 lg:min-h-[calc(100vh-72px)]">
        <div className="relative w-full max-w-[460px] md:flex-1">
          <div className="absolute -inset-5 rounded-[32px] bg-sky-500/[0.08] blur-2xl" aria-hidden="true"           />
          <FlippableCreditCard
            frontOnly
            cvv="•••"
            applicationId={application.id}
            className="relative mx-auto"
          />
        </div>

        <div className="flex w-full max-w-[400px] flex-col items-center text-center md:flex-1">
          <h1 id="card-ready-title" className="text-[28px] font-bold leading-tight tracking-tight">
            Your card is ready
          </h1>
          <p className="mt-3 max-w-[320px] text-[15px] leading-relaxed text-[#9BAEC8]">
            Your physical card has been activated and is ready to use.
          </p>

          <button
            type="button"
            onClick={() => void runAction(onViewCard)}
            disabled={isWorking}
            className="mt-8 h-[54px] w-full max-w-[360px] rounded-xl bg-[#0866F5] px-5 text-[15px] font-semibold text-white transition hover:bg-[#1973f7] active:bg-[#0755c7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#030B17] disabled:cursor-wait disabled:opacity-60"
          >
            View Card Details
          </button>

          {error && (
            <p role="alert" className="mt-4 max-w-[320px] text-center text-sm text-red-300">
              {error}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
