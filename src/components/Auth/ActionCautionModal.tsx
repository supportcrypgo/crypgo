'use client';

import CautionModal from './CautionModal';

interface ActionCautionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ActionCautionModal({ isOpen, onClose }: ActionCautionModalProps) {
  return (
    <CautionModal
      isOpen={isOpen}
      onClose={onClose}
    />
  );
}
