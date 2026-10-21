'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import PinActionLoadingOverlay from '@/app/dashboard/cards/components/PinActionLoadingOverlay';

import BottomNav from '@/app/dashboard/components/BottomNav';
import DesktopHeader from '@/app/dashboard/components/DesktopHeader';
import DesktopSidebar, { SIDEBAR_OFFSET_CLASS } from '@/app/dashboard/components/DesktopSidebar';
import MobileHeader from '@/app/dashboard/components/MobileHeader';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export default function ActivatePinPage() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const router = useRouter();
  const [applicationId, setApplicationId] = React.useState<string | null>(null);
  const [pin, setPin] = React.useState('');
  const [confirmPin, setConfirmPin] = React.useState('');
  const [message, setMessage] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  React.useEffect(() => {
    const requestedId = new URLSearchParams(window.location.search).get('application_id');
    if (requestedId && /^\d+$/.test(requestedId)) {
      setApplicationId(requestedId);
    }
  }, []);

  const backHref = applicationId
    ? `/dashboard/cards/details?application_id=${applicationId}`
    : '/dashboard/cards';

  const handleActivate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pin !== confirmPin) {
      setMessage('PIN entries do not match.');
      return;
    }

    setIsProcessing(true);
    window.setTimeout(() => router.push(backHref), 1200);
  };

  const content = (
    <main className="mx-auto w-full max-w-[760px] px-5 pb-28 pt-5 text-white sm:px-8 sm:pb-12 sm:pt-8">
      <form onSubmit={handleActivate} className="space-y-6">
        {[
          { id: 'pin', label: 'PIN', value: pin, setValue: setPin },
          {
            id: 'confirm-pin',
            label: 'Confirm PIN',
            value: confirmPin,
            setValue: setConfirmPin,
          },
        ].map((field) => (
          <div key={field.id}>
            <input
              id={field.id}
              type="password"
              aria-label={field.label}
              placeholder={field.label}
              inputMode="numeric"
              autoComplete="off"
              value={field.value}
              onChange={(event) => {
                field.setValue(event.target.value);
                setMessage(null);
              }}
              required
              className="h-14 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 text-base text-white outline-none transition placeholder:text-charcoalGray focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </div>
        ))}

        {message && (
          <p
            role={message.startsWith('PIN entries') ? 'alert' : 'status'}
            className={`text-sm ${
              message.startsWith('PIN entries') ? 'text-red-300' : 'text-charcoalGray'
            }`}
          >
            {message}
          </p>
        )}

        <button
          type="submit"
          className="h-[52px] w-full rounded-xl bg-primary font-semibold text-white transition-colors hover:bg-primary/90"
        >
          Activate
        </button>
      </form>
    </main>
  );

  if (isDesktop) {
    return (
      <div className="min-h-screen bg-darkmode text-white">
        <DesktopSidebar />
        <div className={SIDEBAR_OFFSET_CLASS}>
          <DesktopHeader title="Activate PIN" backHref={backHref} backLabel="Back to card" />
          {content}
        </div>
        {isProcessing && <PinActionLoadingOverlay />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-darkmode text-white">
      <MobileHeader
        title="Activate PIN"
        onMenuClick={() => undefined}
        showMenuButton={false}
        showBackButton
        backHref={backHref}
        backLabel="Back to card"
      />
      {content}
      <BottomNav activeTab="cards" />
      {isProcessing && <PinActionLoadingOverlay />}
    </div>
  );
}
