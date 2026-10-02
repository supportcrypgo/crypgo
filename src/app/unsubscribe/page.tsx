'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function UnsubscribePage() {
  const searchParams = useSearchParams();
  const email = (searchParams.get('email') ?? '').trim();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing your unsubscribe request...');

  useEffect(() => {
    let active = true;

    async function unsubscribe() {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (!active) return;
        setStatus('error');
        setMessage('This unsubscribe link is invalid or missing a valid email address.');
        return;
      }

      try {
        const form = new URLSearchParams({
          email,
          reason: 'User requested unsubscribe from email',
        });

        const response = await fetch('/api/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            Accept: 'application/json',
          },
          body: form.toString(),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData?.error || 'Unable to process your unsubscribe request.');
        }

        const result = await response.json().catch(() => ({}));
        if (!active) return;

        if (result?.success === false) {
          throw new Error(result?.error || 'Unable to process your unsubscribe request.');
        }

        setStatus('success');
        setMessage(`You have been unsubscribed: ${email}`);
      } catch (error) {
        if (!active) return;
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'We could not process your unsubscribe request.');
      }
    }

    unsubscribe();

    return () => {
      active = false;
    };
  }, [email]);

  return (
    <main className="min-h-screen bg-darkmode text-white">
      <section className="relative z-1 overflow-hidden md:pt-44 md:pb-40 sm:pt-32 sm:pb-28 pt-28 pb-24">
        <div className="container mx-auto lg:max-w-screen-xl px-4">
          <div className="mx-auto max-w-3xl px-6 py-10 text-center sm:px-12 sm:py-14">
            <div>
              <p className="mb-4 text-18 font-medium uppercase tracking-[0.18em] text-primary">
                Email preferences
              </p>
              <h1 className="mb-6 text-40 text-white sm:text-54">
                Unsubscribe from Cryp<span className="text-primary">go</span>
              </h1>
              <p className="mx-auto max-w-xl text-18 leading-8 text-muted text-opacity-70">
                {status === 'loading' && message}
                {status === 'success' && <span className="text-primary">{message}</span>}
                {status === 'error' && <span className="text-red-200">{message}</span>}
              </p>
              {status !== 'loading' && (
                <a
                  href="/"
                  className="mt-9 inline-block rounded-lg border border-primary bg-primary px-5 py-3 text-18 font-medium text-darkmode hover:bg-transparent hover:text-primary sm:text-21"
                >
                  Return to Crypgo
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
