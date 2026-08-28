'use client';

import { User } from 'lucide-react';
import type { UnifiedUser } from '@/types/unified';

function formatDateOfBirth(dateOfBirth?: string) {
  if (!dateOfBirth) return '—';
  const parsed = new Date(dateOfBirth);
  return Number.isNaN(parsed.getTime()) ? dateOfBirth : parsed.toLocaleDateString();
}

export function ProfileContent({ user }: { user: UnifiedUser }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8">
      {/* Left column - Identity Card (4 columns) */}
      <div className="md:col-span-4">
        <div className="flex flex-col items-center p-0 bg-transparent md:p-6 md:rounded-xl md:bg-muted/20">
          {/* Avatar - 180px on desktop */}
          <div className="w-[180px] h-[180px] rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-2 border-muted">
            {user.avatarInitials ? (
              <span className="text-4xl font-bold text-muted-foreground/50">
                {user.avatarInitials}
              </span>
            ) : (
              <User className="w-20 h-20 text-muted-foreground/50" />
            )}
          </div>

          {/* Identity Information */}
          <h3 className="mt-8 text-2xl font-semibold text-center">
            {user.firstName} {user.lastName}
          </h3>
          <p className="mt-2 text-base text-muted-foreground text-center">
            {user.email}
          </p>
          <p className="mt-2 text-sm text-muted-foreground/70 text-center">
            {user.country}
          </p>
        </div>
      </div>

      {/* Right column - Information Panel (8 columns) */}
      <div className="md:col-span-8">
        <div className="space-y-1">
          {/* Name */}
          <div className="flex flex-col gap-1 px-0 py-4 transition-colors sm:h-16 sm:flex-row sm:items-center sm:gap-0 sm:py-0 md:rounded-lg md:px-4 md:hover:bg-muted/20">
            <span className="w-auto text-sm font-medium text-muted-foreground sm:w-40">Name</span>
            <span className="hidden w-8 text-muted-foreground/30 sm:block">:</span>
            <span className="flex-1">{user.firstName} {user.lastName}</span>
          </div>

          {/* Date of Birth */}
          <div className="flex flex-col gap-1 px-0 py-4 transition-colors sm:h-16 sm:flex-row sm:items-center sm:gap-0 sm:py-0 md:rounded-lg md:px-4 md:hover:bg-muted/20">
            <span className="w-auto text-sm font-medium text-muted-foreground sm:w-40">Date of Birth</span>
            <span className="hidden w-8 text-muted-foreground/30 sm:block">:</span>
            <span className="flex-1">{formatDateOfBirth(user.dateOfBirth)}</span>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1 px-0 py-4 transition-colors sm:h-16 sm:flex-row sm:items-center sm:gap-0 sm:py-0 md:rounded-lg md:px-4 md:hover:bg-muted/20">
            <span className="w-auto text-sm font-medium text-muted-foreground sm:w-40">Email</span>
            <span className="hidden w-8 text-muted-foreground/30 sm:block">:</span>
            <span className="flex-1">{user.email}</span>
          </div>

          {/* Country / Region */}
          <div className="flex flex-col gap-1 px-0 py-4 transition-colors sm:h-16 sm:flex-row sm:items-center sm:gap-0 sm:py-0 md:rounded-lg md:px-4 md:hover:bg-muted/20">
            <span className="w-auto text-sm font-medium text-muted-foreground sm:w-40">Country / Region</span>
            <span className="hidden w-8 text-muted-foreground/30 sm:block">:</span>
            <span className="flex-1">{user.country}</span>
          </div>

          {/* Contact/Phone */}
          <div className="flex flex-col gap-1 px-0 py-4 transition-colors sm:h-16 sm:flex-row sm:items-center sm:gap-0 sm:py-0 md:rounded-lg md:px-4 md:hover:bg-muted/20">
            <span className="w-auto text-sm font-medium text-muted-foreground sm:w-40">Contact</span>
            <span className="hidden w-8 text-muted-foreground/30 sm:block">:</span>
            <span className="flex-1">{user.phone}</span>
          </div>

        </div>
      </div>
    </div>
  );
}
