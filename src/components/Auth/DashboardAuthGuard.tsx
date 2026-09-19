'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

export default function DashboardAuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.replace('/');
    }
  }, [isAuthenticated, loading]);

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      if (!window.localStorage.getItem('access_token')) {
        window.location.replace('/');
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  if (loading || !isAuthenticated) return null;

  return <>{children}</>;
}
