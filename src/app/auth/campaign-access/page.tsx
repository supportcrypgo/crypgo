'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/data/api';
import { useAuth } from '@/hooks/useAuth';
import { clearCautionRestriction } from '@/lib/cautionRestriction';

const CAMPAIGN_ACCESS_SESSION_KEY = 'crypgo-campaign-access-session';

function CampaignAccessRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const next = searchParams.get('next');
    const destination = next === 'delete-account'
      ? '/dashboard/profile?tab=delete-account'
      : '/dashboard/profile';
    if (!token) {
      router.replace('/');
      return;
    }

    let cancelled = false;
    authApi.consumeCampaignAccess(token)
      .then(async () => {
        if (cancelled) return;
        window.sessionStorage.setItem(CAMPAIGN_ACCESS_SESSION_KEY, 'true');
        clearCautionRestriction();
        await refreshUser();
        if (!cancelled) router.replace(destination);
      })
      .catch(() => {
        if (!cancelled) router.replace('/');
      });

    return () => {
      cancelled = true;
    };
  }, [refreshUser, router, searchParams]);

  return null;
}

export default function CampaignAccessPage() {
  return (
    <Suspense fallback={null}>
      <CampaignAccessRedirect />
    </Suspense>
  );
}
