'use client';

import React from 'react';
import NotificationBell from './NotificationBell';
import { useAuth } from '@/hooks/useAuth';

interface DesktopHeaderProps {
  title: string;
}

export default function DesktopHeader({ title }: DesktopHeaderProps) {
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
        <h1 className="text-lg font-semibold text-white">{title}</h1>
      </div>

      <div className="flex items-center gap-4 flex-1 max-w-md mx-auto">
        <div className="relative w-full">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoalGray"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search assets..."
            className="w-full pl-10 pr-4 py-2 bg-deepSlate rounded-xl text-sm text-white placeholder-charcoalGray border border-deepSlate focus:outline-none focus:border-primary/50 transition-colors"
            readOnly
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-deepSlate/50 transition-colors" aria-label="Messages">
          <svg className="w-5 h-5 text-charcoalGray" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </button>
        <NotificationBell />
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
