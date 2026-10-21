'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import LiveAgentHelpButton from '../LiveAgentHelpButton';
import NotificationBell from '../NotificationBell';

interface ProfileHeaderProps {
  showBackButton?: boolean;
  onBackClick?: () => void;
  title?: string;
}

export default function ProfileHeader({
  showBackButton = false,
  onBackClick,
  title = 'My Profile',
}: ProfileHeaderProps) {
  return (
    <header className="relative flex items-center justify-between h-14">
      <div className="flex min-w-0 items-center gap-2">
        {showBackButton ? (
          <>
            <button
              type="button"
              onClick={onBackClick}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted/50"
              aria-label="Go back"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <h1 className="truncate text-base font-semibold">{title}</h1>
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

      <div className="flex items-center gap-0">
        <NotificationBell />
        <LiveAgentHelpButton />
      </div>
    </header>
  );
}
