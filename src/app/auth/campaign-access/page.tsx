'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/data/api';
import { useAuth } from '@/hooks/useAuth';
import { clearCautionRestriction } from '@/lib/cautionRestriction';

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
        clearCautionRestriction();
        await refreshUser();
        if (!cancelled) router.replace('/dashboard/profile');
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
