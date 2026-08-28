'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { downloadUserReport } from '@/data/api';
import {
  clearCautionRestriction,
  markCautionRestrictionActive,
} from '@/lib/cautionRestriction';
import CautionModal from './CautionModal';

const CAUTION_DELAY_MS = 9_000;

interface CautionModalGateProps {
  userId?: string;
  onOpenChange?: (isOpen: boolean) => void;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

export default function CautionModalGate({ userId, onOpenChange }: CautionModalGateProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { logout } = useAuth();
  const reportFileRef = useRef<File | null>(null);
  const reportPromiseRef = useRef<Promise<File> | null>(null);

  const prepareReport = () => {
    if (!reportPromiseRef.current) {
      reportPromiseRef.current = downloadUserReport(userId)
        .then(({ blob, filename }) => {
          const reportName = filename || `Crypgo_Portfolio_Report_${userId || 'me'}_${new Date().toISOString().slice(0, 10)}.pdf`;
          const file = new File([blob], reportName, { type: 'application/pdf' });
          reportFileRef.current = file;
          return file;
        })
        .catch((error) => {
          reportPromiseRef.current = null;
          throw error;
        });
    }
    return reportPromiseRef.current;
  };

  const downloadReport = async () => {
    if (isIOS()) {
      const file = reportFileRef.current;
      if (!file) {
        void prepareReport().catch(() => undefined);
        throw new Error('The report is still preparing. Please tap download again.');
      }
      if (!navigator.canShare || !navigator.canShare({ files: [file] })) {
        throw new Error('This iPhone cannot share PDF files. Please try another browser or device.');
      }

      try {
        await navigator.share({ files: [file], title: file.name });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') throw error;
      }
      return;
    }

    const file = await prepareReport();
    const objectUrl = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = file.name;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  };

  const handleExit = async () => {
    try {
      await logout({ redirect: false });
    } finally {
      clearCautionRestriction();
      window.location.replace('/');
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsOpen(true);
      markCautionRestrictionActive();
      onOpenChange?.(true);
      void prepareReport().catch(() => undefined);
    }, CAUTION_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      onOpenChange?.(false);
    };
  }, [onOpenChange, userId]);

  return (
    <CautionModal
      isOpen={isOpen}
      onExit={handleExit}
      onDownload={downloadReport}
    />
  );
}
