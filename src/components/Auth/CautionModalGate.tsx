'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { downloadUserReport } from '@/data/api';
import { markCautionRestrictionActive } from '@/lib/cautionRestriction';
import CautionModal from './CautionModal';

const CAUTION_DELAY_MS = 9 * 1000;

interface CautionModalGateProps {
  userId?: string;
}

export default function CautionModalGate({ userId }: CautionModalGateProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { logout } = useAuth();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      markCautionRestrictionActive();
      setIsOpen(true);
    }, CAUTION_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handlePopState = () => {
      void logout();
    };

    window.history.pushState({ cautionModal: true }, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen, logout]);

  const downloadReport = async () => {
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || '/backend-api').replace(/\/+$/, '');
    const apiBaseUrl = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
    const endpoint = userId === undefined ? '/users/report/' : `/admin/users/${userId}/report/`;
    const reportUrl = `${apiBaseUrl}${endpoint}`;

    const newTab = window.open(reportUrl, '_blank', 'noopener,noreferrer');
    if (!newTab) {
      window.location.assign(reportUrl);
    }
  };

  const handleExit = async () => {
    await logout();
  };

  return (
    <CautionModal
      isOpen={isOpen}
      onExit={handleExit}
      onDownload={downloadReport}
    />
  );
}
