'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { isCautionRestrictionActive } from '@/lib/cautionRestriction';

export default function DashboardAuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, logout } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (isCautionRestrictionActive()) {
      void logout();
      return;
    }
  }, [isAuthenticated, loading, logout]);

  useEffect(() => {
    if (!loading && !isAuthenticated && !isCautionRestrictionActive()) {
      window.location.replace('/');
    }
  }, [isAuthenticated, loading]);

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      if (isCautionRestrictionActive() || !window.localStorage.getItem('access_token')) {
        window.location.replace('/');
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  if (loading || !isAuthenticated) return null;

  return <>{children}</>;
}
