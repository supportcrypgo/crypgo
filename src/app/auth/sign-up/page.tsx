'use client';

import SignUp from '@/components/Auth/SignUp';

export default function SignUpPage() {
  return (
    <main className="min-h-dvh bg-dark_grey px-5 pb-16 pt-28 text-white sm:pt-32">
      <section className="mx-auto w-full max-w-md animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
        <SignUp showLogo={false} />
      </section>
    </main>
  );
}
