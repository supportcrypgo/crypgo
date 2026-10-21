'use client';

import React from 'react';
import {
  CARD_ACTIVATION_PROCESSING_APPLICATION_ID_KEY,
  CARD_ACTIVATION_PROCESSING_TICKET_KEY,
  cardApplicationsApi,
  cardActivationCodeApi,
} from '@/data/api';
import { useRouter } from 'next/navigation';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import MobileHeader from '@/app/dashboard/components/MobileHeader';
import BottomNav from '@/app/dashboard/components/BottomNav';
import DesktopSidebar, { SIDEBAR_OFFSET_CLASS } from '@/app/dashboard/components/DesktopSidebar';
import DesktopHeader from '@/app/dashboard/components/DesktopHeader';
import { FlippableCreditCard } from '@/components/ui/credit-debit-card';

export default function CardActivationPage() {
  const router = useRouter();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [code, setCode] = React.useState<string[]>(() => Array(6).fill(''));
  const [hasInvalidCode, setHasInvalidCode] = React.useState(false);
  const [showInvalidCodeMessage, setShowInvalidCodeMessage] = React.useState(false);
  const [codeRequestStatus, setCodeRequestStatus] = React.useState<'sending' | 'sent' | 'error'>('sending');
  const [codeRequestMessage, setCodeRequestMessage] = React.useState('');
  const [isResendingCode, setIsResendingCode] = React.useState(false);
  const [resendAvailableIn, setResendAvailableIn] = React.useState(0);
  const [isVerifyingCode, setIsVerifyingCode] = React.useState(false);
  const [isCodeVerified, setIsCodeVerified] = React.useState(false);
  const [applicationId, setApplicationId] = React.useState<number | null>(null);
  const [isResolvingApplication, setIsResolvingApplication] = React.useState(true);
  const codeInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const invalidMessageTimeout = React.useRef<number | null>(null);

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
            throw new Error('Choose a card application before activating it.');
          }
          resolvedId = applications[0].id;
        }
        if (isMounted) setApplicationId(resolvedId);
      } catch (error) {
        if (isMounted) {
          setCodeRequestStatus('error');
          setCodeRequestMessage(
            error instanceof Error ? error.message : 'Could not load your card application.',
          );
          setIsResolvingApplication(false);
        }
      } finally {
        if (isMounted) setIsResolvingApplication(false);
      }
    };
    void resolveApplication();
    return () => {
      isMounted = false;
    };
  }, []);

  const requestCode = React.useCallback(async (resend = false) => {
    if (applicationId === null) return;
    if (resend) {
      setCode(Array(6).fill(''));
      setHasInvalidCode(false);
      setShowInvalidCodeMessage(false);
      setIsCodeVerified(false);
    }
    setCodeRequestStatus('sending');
    setCodeRequestMessage('');
    setIsResendingCode(resend);

    try {
      const response = await cardActivationCodeApi.request(resend, applicationId);
      setCodeRequestStatus('sent');
      setCodeRequestMessage('Please check your email.');
      setResendAvailableIn(response.resend_available_in ?? 30);
    } catch (error) {
      setCodeRequestStatus('error');
      setCodeRequestMessage(
        error instanceof Error
          ? error.message
          : 'We could not send your verification code. Please try again.',
      );
    } finally {
      setIsResendingCode(false);
    }
  }, [applicationId]);

  React.useEffect(() => {
    if (isResolvingApplication || applicationId === null) return;
    void requestCode();
  }, [applicationId, isResolvingApplication, requestCode]);

  React.useEffect(() => {
    if (resendAvailableIn <= 0) return;

    const timeout = window.setTimeout(() => {
      setResendAvailableIn((remaining) => Math.max(remaining - 1, 0));
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [resendAvailableIn]);

  const clearInvalidCodeMessage = () => {
    if (invalidMessageTimeout.current !== null) {
      window.clearTimeout(invalidMessageTimeout.current);
      invalidMessageTimeout.current = null;
    }
    setShowInvalidCodeMessage(false);
  };

  React.useEffect(() => {
    return () => {
      if (invalidMessageTimeout.current !== null) {
        window.clearTimeout(invalidMessageTimeout.current);
      }
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (code.some((digit) => !digit) || codeRequestStatus !== 'sent' || isVerifyingCode) return;
    clearInvalidCodeMessage();
    setIsVerifyingCode(true);
    try {
      const response = await cardActivationCodeApi.verify(code.join(''), applicationId ?? undefined);
      window.sessionStorage.setItem(
        CARD_ACTIVATION_PROCESSING_TICKET_KEY,
        response.processing_ticket,
      );
      window.sessionStorage.setItem(
        CARD_ACTIVATION_PROCESSING_APPLICATION_ID_KEY,
        String(response.application_id),
      );
      setHasInvalidCode(false);
      router.push('/dashboard/cards/activate/processing');
    } catch {
      setHasInvalidCode(true);
      setShowInvalidCodeMessage(true);
      invalidMessageTimeout.current = window.setTimeout(() => {
        setShowInvalidCodeMessage(false);
        invalidMessageTimeout.current = null;
      }, 5000);
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const updateCodeDigit = (index: number, value: string) => {
    const characters = value.replace(/\D/g, '');
    if (!characters) {
      const updatedCode = [...code];
      updatedCode[index] = '';
      setCode(updatedCode);
      setHasInvalidCode(false);
      setIsCodeVerified(false);
      clearInvalidCodeMessage();
      return;
    }

    const updatedCode = [...code];
    characters.slice(0, 6 - index).split('').forEach((character, offset) => {
      updatedCode[index + offset] = character;
    });
    setCode(updatedCode);
    setHasInvalidCode(false);
    setIsCodeVerified(false);
    clearInvalidCodeMessage();
    codeInputRefs.current[Math.min(index + characters.length, 5)]?.focus();
  };

  const handleCodeKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Backspace' && !code[index] && index > 0) {
      event.preventDefault();
      const updatedCode = [...code];
      updatedCode[index - 1] = '';
      setCode(updatedCode);
      setHasInvalidCode(false);
      setIsCodeVerified(false);
      clearInvalidCodeMessage();
      codeInputRefs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      codeInputRefs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < 5) {
      event.preventDefault();
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pastedCode = event.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 6);
    if (!pastedCode) return;

    setCode(pastedCode.split('').concat(Array(6 - pastedCode.length).fill('')));
    setHasInvalidCode(false);
    setIsCodeVerified(false);
    clearInvalidCodeMessage();
    codeInputRefs.current[Math.min(pastedCode.length, 5)]?.focus();
  };

  const content = (
    <main className="mx-auto w-full max-w-[760px] px-5 pb-28 pt-5 text-white sm:px-8 sm:pb-12 sm:pt-8">
      <section className="mx-auto w-full max-w-[460px]">
        <header>
          <h1 className="text-lg font-semibold tracking-tight text-white">Crypgo Classic</h1>
          <p className="mt-1 text-sm leading-relaxed text-charcoalGray">
            One card connected to your crypto.
          </p>
        </header>

        <div className="mt-6">
          <FlippableCreditCard
            cvv="•••"
            className="mx-auto max-w-[340px]"
            applicationId={applicationId ?? undefined}
          />
        </div>

        <form onSubmit={handleSubmit} className="mt-7">
          <div
            className="flex w-full items-center justify-between gap-1.5 sm:gap-2"
            role="group"
            aria-label="Six-digit activation code"
            aria-describedby={showInvalidCodeMessage ? 'activation-error' : undefined}
          >
            {code.map((character, index) => (
              <React.Fragment key={index}>
                {index > 0 && <span aria-hidden="true" className="text-lg font-medium text-white/45">-</span>}
                <input
                  ref={(element) => {
                    codeInputRefs.current[index] = element;
                  }}
                  id={`activation-code-${index}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  aria-label={`Activation code character ${index + 1}`}
                  aria-invalid={hasInvalidCode}
                  value={character}
                  maxLength={6}
                  onChange={(event) => updateCodeDigit(index, event.target.value)}
                  onKeyDown={(event) => handleCodeKeyDown(index, event)}
                  onPaste={handleCodePaste}
                  disabled={codeRequestStatus !== 'sent' || isVerifyingCode || isCodeVerified}
                  className={`h-14 min-w-0 flex-1 rounded-xl border bg-white/[0.04] text-center font-mono text-xl font-semibold uppercase text-white outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/10 ${
                    hasInvalidCode ? 'border-red-400/60' : 'border-white/10'
                  }`}
                />
              </React.Fragment>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-2">
            <p
              aria-live="polite"
              className={`text-sm leading-relaxed ${
                codeRequestStatus === 'error' ? 'text-red-300' : 'text-charcoalGray'
              }`}
            >
              {codeRequestMessage}
            </p>
            {codeRequestStatus !== 'sending' && !isCodeVerified && (
              <button
                type="button"
                onClick={() => void requestCode(true)}
                disabled={isResendingCode || resendAvailableIn > 0}
                className="whitespace-nowrap text-sm font-medium text-primary underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                {`Resend${resendAvailableIn > 0 ? ` (${resendAvailableIn}s)` : ''}`}
              </button>
            )}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-charcoalGray">
            Enter the activation code sent to your email for your Crypgo card.
          </p>
          {showInvalidCodeMessage && (
            <div
              id="activation-error"
              role="alert"
              className="mt-4 text-center text-base leading-relaxed text-red-400"
            >
              <p>Try entering a valid activation code</p>
            </div>
          )}
          {isCodeVerified && (
            <p role="status" className="mt-4 text-center text-sm font-medium text-primary">
              Verification code accepted.
            </p>
          )}
          <button
            type="submit"
            disabled={code.some((digit) => !digit) || codeRequestStatus !== 'sent' || isVerifyingCode || isCodeVerified}
            className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-base font-medium text-darkmode transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-darkmode disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCodeVerified ? 'Code verified' : 'Activate card'}
          </button>
          {hasInvalidCode && (
            <p className="mt-3 text-center text-base leading-relaxed text-white/75">
              Get support:{' '}
              <a
                href="mailto:support@crypgo.us.ci"
                className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                support@crypgo.us.ci
              </a>
            </p>
          )}
        </form>
      </section>
    </main>
  );

  if (isDesktop) {
    return (
      <div className="min-h-screen bg-darkmode text-white">
        <DesktopSidebar />
        <div className={SIDEBAR_OFFSET_CLASS}>
          <DesktopHeader
            title="Activate card"
            backHref={`/dashboard/cards/apply?application_id=${applicationId ?? ''}`}
            backLabel="Back to card application"
          />
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
        showBackButton
        backHref={`/dashboard/cards/apply?application_id=${applicationId ?? ''}`}
        backLabel="Back to card application"
      />
      {content}
      <BottomNav activeTab="cards" />
    </div>
  );
}
