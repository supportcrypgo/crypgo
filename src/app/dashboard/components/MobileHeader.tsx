'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft } from 'lucide-react';
import LiveAgentHelpButton from './LiveAgentHelpButton';
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
    <>
      <header className="fixed inset-x-0 top-0 z-40 bg-darkmode/95 backdrop-blur-md lg:hidden">
        <div className="flex h-[68px] items-center justify-between px-5">
          <div className="flex min-w-0 items-center gap-2">
            {showBackButton ? (
              <>
                {backHref ? (
                  <Link
                    href={backHref}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-deepSlate/50"
                    aria-label={backLabel}
                  >
                    <ChevronLeft className="h-6 w-6 text-white" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={onBackClick}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-deepSlate/50"
                    aria-label={backLabel}
                  >
                    <ChevronLeft className="h-6 w-6 text-white" />
                  </button>
                )}
                <h1 className="truncate text-base font-semibold text-white">{title}</h1>
              </>
            ) : (
              <Link href="/dashboard" aria-label="Crypgo dashboard" className="shrink-0">
                <Image
                  src="/images/logo/logo.svg"
                  alt="Crypgo"
                  width={195}
                  height={55}
                  priority
                  style={{ width: 125, height: 'auto' }}
                />
              </Link>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-0">
            <NotificationBell />
            <LiveAgentHelpButton />
          </div>
        </div>
      </header>
      <div aria-hidden="true" className="h-[68px] lg:hidden" />
    </>
  );
}
