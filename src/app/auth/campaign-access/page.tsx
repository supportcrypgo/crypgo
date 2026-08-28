'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Logo from '@/components/Layout/Header/Logo';
import { authApi } from '@/data/api';
import { useAuth } from '@/hooks/useAuth';

export default function CampaignAccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      router.replace('/');
      return;
    }

    let cancelled = false;
    authApi.consumeCampaignAccess(token)
      .then(async () => {
        if (cancelled) return;
        await refreshUser();
        if (!cancelled) router.replace('/dashboard');
      })
      .catch(() => {
        if (!cancelled) router.replace('/');
      });

    return () => {
      cancelled = true;
    };
  }, [refreshUser, router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-darkmode px-6 text-center text-white">
      <div className="flex w-full max-w-md flex-col items-center">
        <div className="mb-8 inline-block max-w-[160px]"><Logo /></div>
        <Loader2 className="h-10 w-10 animate-spin" aria-label="Loading" />
      </div>
    </main>
  );
}
