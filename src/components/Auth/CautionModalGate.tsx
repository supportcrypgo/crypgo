'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { downloadUserReport } from '@/data/api';
import CautionModal from './CautionModal';

const CAUTION_DELAY_MS = 19_000;

interface CautionModalGateProps {
  userId?: string;
}

export default function CautionModalGate({ userId }: CautionModalGateProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { logout } = useAuth();

  useEffect(() => {
    const timer = window.setTimeout(() => setIsOpen(true), CAUTION_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const downloadReport = async () => {
    const { blob, filename } = await downloadUserReport(userId);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename || `Crypgo_Portfolio_Report_${userId || 'me'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
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
