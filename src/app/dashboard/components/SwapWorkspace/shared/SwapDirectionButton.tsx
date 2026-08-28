'use client';

import React from 'react';
import { ArrowDownUp } from 'lucide-react';

interface SwapDirectionButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export default function SwapDirectionButton({ onClick, disabled = false }: SwapDirectionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-shrink-0 w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/30 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
      aria-label="Swap pay and receive assets"
    >
      <ArrowDownUp className="w-5 h-5 text-white" />
    </button>
  );
}