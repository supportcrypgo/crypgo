'use client';

import { Camera, User } from 'lucide-react';
import type { UnifiedUser } from '@/types/unified';

interface ProfileIdentityProps {
  user?: UnifiedUser | null;
}

export default function ProfileIdentity({ user }: ProfileIdentityProps) {
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

        {/* Edit button - overlapping lower-right */}
        <button
          className="absolute bottom-0 right-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center border-2 border-background hover:scale-105 transition-transform"
          aria-label="Edit profile picture"
        >
          <Camera className="w-5 h-5" />
        </button>
      </div>

      {/* Name - 24px gap from avatar */}
      <h2 className="mt-6 text-3xl font-semibold text-center">
        {user.firstName} {user.lastName}
      </h2>

      {/* Email - 10px gap from name */}
      <p className="mt-2.5 text-lg text-muted-foreground text-center">
        {user.email}
      </p>

      {/* Location - 10px gap from email */}
      <p className="mt-2.5 text-base text-muted-foreground/70 text-center hidden md:block">
        {user.country}
      </p>
    </div>
  );
}
