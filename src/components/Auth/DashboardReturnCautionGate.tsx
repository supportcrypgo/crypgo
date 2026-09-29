'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import CautionModal from './CautionModal';

const ACTION_PATHS = [
  '/dashboard/wallet/send',
  '/dashboard/swap',
  '/dashboard/wallet/receive',
];

function getPendingReturnKey(userId: string) {
  return `crypgo:dashboard-return-caution:${userId}`;
}

export default function DashboardReturnCautionGate() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const checkForReturn = useCallback(() => {
    if (!user?.transactionGuardEnabled || !user.id || pathname !== '/dashboard') return;

    const pendingKey = getPendingReturnKey(user.id);
    if (window.sessionStorage.getItem(pendingKey) !== '1') return;

    window.sessionStorage.removeItem(pendingKey);
    setIsOpen(true);
  }, [pathname, user?.id, user?.transactionGuardEnabled]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || !user.transactionGuardEnabled || !pathname) return;

    if (ACTION_PATHS.some((actionPath) => pathname === actionPath || pathname.startsWith(`${actionPath}/`))) {
      window.sessionStorage.setItem(getPendingReturnKey(user.id), '1');
      return;
    }

    checkForReturn();
  }, [checkForReturn, isAuthenticated, pathname, user?.id, user?.transactionGuardEnabled]);

  useEffect(() => {
    window.addEventListener('pageshow', checkForReturn);
    return () => window.removeEventListener('pageshow', checkForReturn);
  }, [checkForReturn]);

  return <CautionModal isOpen={isOpen} onClose={() => setIsOpen(false)} />;
}