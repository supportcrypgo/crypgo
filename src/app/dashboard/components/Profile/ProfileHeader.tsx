'use client';

import { ChevronLeft, Bell } from 'lucide-react';

interface ProfileHeaderProps {
  showBackButton?: boolean;
  onBackClick?: () => void;
}

export default function ProfileHeader({ showBackButton = false, onBackClick }: ProfileHeaderProps) {
  return (
    <header className="relative flex items-center justify-between h-14">
      {showBackButton ? (
        <button
          type="button"
          onClick={onBackClick}
          className="flex items-center justify-center w-11 h-11 -ml-2 rounded-full hover:bg-muted/50 transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      ) : (
        <div aria-hidden="true" className="w-11 h-11 -ml-2" />
      )}

      <h1 className="absolute left-1/2 -translate-x-1/2 text-xl font-semibold">
        My Profile
      </h1>

      <button
        className="flex items-center justify-center w-11 h-11 -mr-2 rounded-full hover:bg-muted/50 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6" />
      </button>
    </header>
  );
}
