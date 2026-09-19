'use client';

import { useRouter } from 'next/navigation';
import CautionModal from './CautionModal';

interface ActionCautionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ActionCautionModal({ isOpen, onClose }: ActionCautionModalProps) {
  const router = useRouter();

  return (
    <CautionModal
      isOpen={isOpen}
      onClose={onClose}
      onGotIt={() => router.push('/dashboard')}
    />
  );
}
