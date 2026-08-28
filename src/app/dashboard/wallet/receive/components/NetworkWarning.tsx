'use client';

import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { NetworkOption } from './types';

interface NetworkWarningProps {
  network: NetworkOption;
}

export default function NetworkWarning({ network }: NetworkWarningProps) {
  const isHighRisk = network.addressType === 'base58' || network.memoRequired;

  return (
    <div className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border ${
      isHighRisk
        ? 'bg-amber-500/10 border-amber-500/20'
        : 'bg-white/5 border-white/5'
    }`}>
      {isHighRisk ? (
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
      ) : (
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
      )}
      <div className="min-w-0">
        <p className={`text-sm leading-snug ${isHighRisk ? 'text-amber-200' : 'text-charcoalGray'}`}>
          {network.warning}
        </p>
        {network.minDepositInUsd && (
          <p className="mt-1 text-xs text-charcoalGray">
            Minimum deposit: <span className="text-white font-medium">{network.minDeposit}</span> {' '}
            <span className="text-charcoalGray">({network.minDepositInUsd})</span>
          </p>
        )}
      </div>
    </div>
  );
}