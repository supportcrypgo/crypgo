'use client';

import React from 'react';
import { Send, ArrowDownLeft, RefreshCw } from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
}

interface QuickActionsCardProps {}

const quickActions: QuickAction[] = [
  {
    id: 'send',
    label: 'Send',
    icon: <Send className="w-5 h-5 sm:w-6 sm:h-6" />,
    href: '/dashboard/wallet/send',
  },
  {
    id: 'receive',
    label: 'Receive',
    icon: <ArrowDownLeft className="w-5 h-5 sm:w-6 sm:h-6" />,
    href: '/dashboard/wallet/receive',
  },
  {
    id: 'swap',
    label: 'Swap',
    icon: <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6" />,
    href: '/dashboard/swap',
  },
];

export default function QuickActionsCard(_: QuickActionsCardProps) {
  return (
    <div className="mb-5">
      <div className="mx-auto grid max-w-[240px] grid-cols-3 gap-4">
        {quickActions.map((action) => (
          <a
            key={action.id}
            href={action.href}
            className="relative justify-self-center overflow-visible flex h-14 w-14 flex-col items-center justify-center rounded-full border border-white/10 bg-transparent px-0 py-0 transition-colors hover:border-primary/30 sm:justify-self-stretch sm:h-auto sm:w-auto sm:rounded-xl sm:px-0.5 sm:py-2"
            onClick={(e) => {
              if (action.onClick) {
                e.preventDefault();
                action.onClick();
              }
            }}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full text-white sm:rounded-xl">
              {action.icon}
            </div>
            <span className="absolute top-full left-1/2 mt-1.5 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-center text-white">
              {action.label}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
