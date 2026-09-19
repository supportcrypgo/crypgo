'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { markCautionRestrictionActive } from '@/lib/cautionRestriction';
import CautionModal from './CautionModal';

const PASSWORD_LOGIN_DELAY_MS = 8 * 1000;
const CAMPAIGN_ACCESS_DELAY_MS = 15 * 1000;

export default function CautionModalGate() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const delay = window.sessionStorage.getItem('crypgo-campaign-access-session') === 'true'
      ? CAMPAIGN_ACCESS_DELAY_MS
      : PASSWORD_LOGIN_DELAY_MS;
    const timer = window.setTimeout(() => {
      markCautionRestrictionActive();
      setIsOpen(true);
    }, delay);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <CautionModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onGotIt={() => router.push('/dashboard')}
    />
  );
}
