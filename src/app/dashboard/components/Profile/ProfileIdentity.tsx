'use client';

import { ChevronDown, User } from 'lucide-react';
import type { UnifiedUser } from '@/types/unified';
import { useDisplayCurrency } from '@/context/DisplayCurrencyContext';

interface ProfileIdentityProps {
  user?: UnifiedUser | null;
  onCurrencyClick: () => void;
}

export default function ProfileIdentity({ user, onCurrencyClick }: ProfileIdentityProps) {
  const { currency } = useDisplayCurrency();

  if (!user) {
    return (
      <div className="flex flex-col items-center text-center text-muted-foreground">
        <div className="w-[140px] h-[140px] rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-2 border-muted">
          <User className="w-16 h-16 text-muted-foreground/50" />
        </div>
        <p className="mt-6 text-sm">No profile data available.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* Avatar Container - 140px diameter on mobile */}
      <div className="relative">
        <div className="w-[140px] h-[140px] rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-2 border-muted">
          {user.avatarInitials ? (
            <span className="text-3xl font-bold text-muted-foreground/50">
              {user.avatarInitials}
            </span>
          ) : (
            <User className="w-16 h-16 text-muted-foreground/50" />
          )}
        </div>

      </div>

      {/* Name - 24px gap from avatar */}
      <button
        type="button"
        onClick={onCurrencyClick}
        aria-label={`Display currency: ${currency}`}
        className="mt-4 inline-flex min-h-10 items-center gap-2 px-1 text-sm font-medium text-white transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span>{currency}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </button>

      <h2 className="mt-1 text-3xl font-semibold text-center md:mt-4">
        {user.firstName} {user.lastName}
      </h2>

      {/* Email - 10px gap from name */}
      <p id="profile-identity-email" className="mt-2.5 text-lg text-muted-foreground text-center no-underline [text-decoration:none]">
        {user.email}
      </p>

      {/* Location - 10px gap from email */}
      <p className="mt-2.5 text-base text-muted-foreground/70 text-center hidden md:block">
        {user.identityDetailsVerified && currency === 'USD' ? user.country : null}
      </p>
    </div>
  );
}
