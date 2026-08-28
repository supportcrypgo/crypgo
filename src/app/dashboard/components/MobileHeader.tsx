'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import Logo from '@/components/Layout/Header/Logo';
import NotificationBell from './NotificationBell';

interface MobileHeaderProps {
  onMenuClick: () => void;
  title?: string;
  showMenuButton?: boolean;
  showBackButton?: boolean;
  backHref?: string;
  onBackClick?: () => void;
  backLabel?: string;
}

export default function MobileHeader({
  onMenuClick,
  title = 'Dashboard',
  showMenuButton = true,
  showBackButton = false,
  backHref,
  onBackClick,
  backLabel = 'Go back',
}: MobileHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-darkmode/95 backdrop-blur-md lg:hidden">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center h-[68px] px-5">
        {showBackButton ? (
          backHref ? (
            <Link
              href={backHref}
              className="flex items-center justify-center w-10 h-10 -ml-1 rounded-full hover:bg-deepSlate/50 transition-colors"
              aria-label={backLabel}
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={onBackClick}
              className="flex items-center justify-center w-10 h-10 -ml-1 rounded-full hover:bg-deepSlate/50 transition-colors"
              aria-label={backLabel}
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          )
        ) : (
          <div aria-hidden="true" />
        )}

        {/* Center: Title */}
        <h1 className="text-lg font-semibold text-white px-4">{title}</h1>

        {/* Right: Notification + Profile */}
        <div className="flex items-center justify-end gap-3">
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
