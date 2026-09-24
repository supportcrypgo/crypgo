'use client';

import { AlertTriangle, X } from 'lucide-react';

interface CautionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CautionModal({ isOpen, onClose }: CautionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-amber-400/30 bg-[#1e293b] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close caution notice"
          className="absolute right-4 top-4 rounded-lg p-2 text-charcoalGray transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/15">
          <AlertTriangle className="h-6 w-6 text-amber-300" />
        </div>
        <h2 className="mt-5 text-xl font-semibold text-white">Transaction caution</h2>
        <p className="mt-3 text-sm leading-6 text-charcoalGray">
          This transaction was not processed because your account safety limit has been reached. A notification has been sent to your account email.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-primary/90"
        >
          Close
        </button>
      </div>
    </div>
  );
}