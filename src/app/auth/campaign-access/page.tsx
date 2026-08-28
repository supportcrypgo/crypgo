'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/data/api';
import { useAuth } from '@/hooks/useAuth';

export default function CampaignAccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuthenticatedUser, refreshUser } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      router.replace('/?signin=1');
      return;
    }

    let cancelled = false;

    const handleAccess = async () => {
      try {
        const authResponse = await authApi.consumeCampaignAccess(token);
        if (authResponse.user) {
          setAuthenticatedUser(authResponse.user);
        } else {
          await refreshUser();
        }
        if (!cancelled) {
          router.replace('/dashboard/');
        }
      } catch {
        if (!cancelled) {
          router.replace('/?signin=1');
        }
      }
    };

    void handleAccess();

    return () => {
      cancelled = true;
    };
  }, [refreshUser, router, searchParams, setAuthenticatedUser]);

  return null;
}
