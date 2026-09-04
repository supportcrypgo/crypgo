'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { downloadUserReport } from '@/data/api';
import { markCautionRestrictionActive } from '@/lib/cautionRestriction';
import CautionModal from './CautionModal';

const CAUTION_DELAY_MS = 9 * 60 * 1000;

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
    const { blob, filename } = await downloadUserReport(userId);
    const reportName = filename || `Crypgo_Portfolio_Report_${userId || 'me'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    const file = new File([blob], reportName, { type: blob.type || 'application/pdf' });

    if (typeof navigator.share === 'function') {
      const shareData = { files: [file], title: reportName };
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        try {
          await navigator.share(shareData);
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return;
        }
      }
    }

    const objectUrl = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = reportName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  const handleExit = async () => {
    await downloadReport();
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
