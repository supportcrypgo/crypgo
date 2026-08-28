'use client';

import React from 'react';
import { RecipientInfo } from './types';

interface RecipientFieldProps {
  address: string;
  isValid: boolean;
  isValidNetwork: boolean;
  error?: string;
  onChange: (address: string) => void;
}

export default function RecipientField({
  address,
  isValid,
  isValidNetwork,
  error,
  onChange,
}: RecipientFieldProps) {
  // Determine border color based on validation state when there's input
  const borderClass = address
    ? isValid && isValidNetwork
      ? 'border-green-500/50 focus:border-green-500'
      : error
        ? 'border-red-500/50 focus:border-red-500'
        : 'border-white/5 focus:border-primary/50'
    : 'border-white/5 focus:border-primary/50';

  return (
    <div className="space-y-4">
      <label className="text-xs font-medium text-charcoalGray uppercase tracking-wider block">
        Recipient Address
      </label>
      
      <div className="relative">
        <input
          type="text"
          value={address}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter recipient address"
          className={`w-full px-4 py-3.5 bg-white/5 border rounded-xl text-white placeholder-charcoalGray transition-colors ${borderClass}`}
        />
        {isValid && isValidNetwork && address && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}