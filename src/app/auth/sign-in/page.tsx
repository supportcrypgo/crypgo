'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SignIn from '@/components/Auth/SignIn';

function SignInPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [magicLinkToken, setMagicLinkToken] = useState(searchParams.get('magicToken'));
  const [passwordResetToken, setPasswordResetToken] = useState(searchParams.get('resetToken'));

  return (
    <main className="min-h-dvh bg-darkmode px-5 pb-16 pt-28 text-white sm:pt-32">
      <section className="mx-auto w-full max-w-md animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <SignIn
            magicLinkToken={magicLinkToken}
            passwordResetToken={passwordResetToken}
            showLogo={false}
            onPasswordChanged={() => {
              setMagicLinkToken(null);
              setPasswordResetToken(null);
              router.replace('/auth/sign-in');
            }}
            onSuccess={() => router.replace('/dashboard')}
          />
      </section>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-darkmode" />}>
      <SignInPageContent />
    </Suspense>
  );
}
