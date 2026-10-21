'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import LiveAgentHelpButton from './LiveAgentHelpButton';
import NotificationBell from './NotificationBell';

interface DesktopHeaderProps {
  title: string;
  backHref?: string;
  backLabel?: string;
}

export default function DesktopHeader({
  title,
  backHref,
  backLabel = 'Go back',
}: DesktopHeaderProps) {
  const { user } = useAuth();
  const initials =
    user?.avatarInitials?.trim() ||
    [user?.firstName?.[0], user?.lastName?.[0]]
      .filter(Boolean)
      .join('')
      .toUpperCase() ||
    'U';
  const label = user ? `User profile: ${initials}` : 'User profile';

  return (
    <header className="h-[72px] flex items-center justify-between px-6 border-b border-deepSlate bg-darkmode/95 backdrop-blur-md sticky top-0 z-40">
      <div className="flex items-center gap-4">
        {backHref && (
          <Link
            href={backHref}
            aria-label={backLabel}
            title={backLabel}
            className="flex h-10 w-10 items-center justify-center rounded-full text-charcoalGray transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        )}
        <h1 className="text-lg font-semibold text-white">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0">
          <NotificationBell />
          <LiveAgentHelpButton />
        </div>
        <div
          className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center overflow-hidden"
          role="img"
          aria-label={label}
        >
          <span className="text-xs font-bold text-darkmode">{initials}</span>
        </div>
      </div>
    </header>
  );
}
