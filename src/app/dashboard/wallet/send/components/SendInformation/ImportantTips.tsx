'use client';

import React from 'react';
import { SendAssetInfo, NetworkOption } from '../types';
import { CheckCircle2, Info, Clock3, ShieldCheck, AlertCircle } from 'lucide-react';

interface ImportantTipsProps {
  asset: SendAssetInfo;
  network: NetworkOption;
}

export default function ImportantTips({ asset, network }: ImportantTipsProps) {
  // Generate tips based on asset/network
  const tips = [
    {
      icon: CheckCircle2,
      iconColor: 'text-green-400',
      title: 'Correct Address Verify',
      description: 'Always verify the address is copied exactly without extra spaces.',
    },
    {
      icon: Info,
      iconColor: 'text-blue-400',
      title: 'Network Match',
      description: `Send only on the ${network.name} network. Mismatched networks can cause loss of funds.`,
    },
    {
      icon: Clock3,
      iconColor: 'text-amber-400',
      title: 'Proceed with Caution',
      description: 'Once sent, transactions cannot be reversed on the blockchain.',
    },
    {
      icon: ShieldCheck,
      iconColor: 'text-primary',
      title: 'Double-Check Details',
      description: `Minimum: ${network.minDeposit} (${network.minDepositInUsd}). ${network.confirmations} ${network.confirmationsLabel || 'confirmations'} required.`,
    },
  ];

  // Add memo warning if needed
  if (network.memoRequired) {
    tips.push({
      icon: AlertCircle,
      iconColor: 'text-orange-400',
      title: `${network.memoLabel || 'Memo/Tag'} required`,
      description: `This network requires a ${network.memoLabel?.toLowerCase() || 'memo/tag'}. Without it, funds may be lost or require manual recovery.`,
    });
  }

  return (
    <div className="hidden lg:block bg-deepSlate/50 border border-white/5 rounded-2xl p-6 space-y-4 animate-in fade-in-50 slide-in-from-right-1 duration-200">
      <h3 className="text-sm font-semibold text-white">Important Tips</h3>
      <div className="space-y-4">
        {tips.map((tip) => {
          const Icon = tip.icon;
          return (
            <div key={tip.title} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <Icon className={`w-4 h-4 ${tip.iconColor}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{tip.title}</p>
                <p className="text-xs text-charcoalGray leading-relaxed mt-0.5">{tip.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
