'use client';

import React from 'react';
import { CheckCircle2, Info, Clock3, ShieldCheck } from 'lucide-react';

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
    description: 'Send only on the network selected. Mismatched networks can cause loss.',
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
    title: 'Secure & Private',
    description: 'Your address is public. Never share your private keys or seed phrase.',
  },
];

export default function ImportantTips() {
  return (
    <div className="space-y-4 lg:bg-deepSlate/50 lg:border lg:border-white/5 lg:rounded-2xl lg:p-6">
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
