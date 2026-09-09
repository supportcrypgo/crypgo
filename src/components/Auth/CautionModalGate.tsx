'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { downloadUserReport } from '@/data/api';
import { markCautionRestrictionActive } from '@/lib/cautionRestriction';
import CautionModal from './CautionModal';

const CAUTION_DELAY_MS = 8 * 1000;

interface CautionModalGateProps {
  userId?: string;
}

type ReportDownload = Awaited<ReturnType<typeof downloadUserReport>>;

export default function CautionModalGate({ userId }: CautionModalGateProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [preparedReport, setPreparedReport] = useState<ReportDownload | null>(null);
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

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setPreparedReport(null);
    downloadUserReport(userId)
      .then((report) => {
        if (!cancelled) setPreparedReport(report);
      })
      .catch(() => {
        if (!cancelled) setPreparedReport(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, userId]);

  const downloadReport = async () => {
    const { blob, filename } = preparedReport || await downloadUserReport(userId);
    const reportFilename = filename || `Crypgo_Portfolio_Report_${userId ?? 'user'}.pdf`;

    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function'
    ) {
      const reportFile = new File([blob], reportFilename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [reportFile] })) {
        await navigator.share({
          files: [reportFile],
          title: 'Crypgo account report',
        });
        return;
      }
    }

    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = reportFilename;
    anchor.rel = 'noopener noreferrer';
    anchor.style.display = 'none';

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
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
