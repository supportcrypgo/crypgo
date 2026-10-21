'use client';

import { ChevronDown, User } from 'lucide-react';
import type { UnifiedUser } from '@/types/unified';
import { useDisplayCurrency } from '@/context/DisplayCurrencyContext';

function formatDateOfBirth(dateOfBirth?: string) {
  if (!dateOfBirth) return '—';
  const parsed = new Date(dateOfBirth);
  return Number.isNaN(parsed.getTime()) ? dateOfBirth : parsed.toLocaleDateString();
}

export function ProfileContent({ user, onCurrencyClick }: { user: UnifiedUser; onCurrencyClick: () => void }) {
  const { currency } = useDisplayCurrency();
  const identityDetailsVerified = user.identityDetailsVerified === true && currency === 'USD';
  const verificationStatus = user.identityDetailsVerified
    ? { label: 'Verified', className: 'text-emerald-400' }
    : user.kycStatus === 'verified'
      ? { label: 'Approved — details under review', className: 'text-amber-300' }
      : user.kycStatus === 'pending'
        ? { label: 'Under review', className: 'text-amber-300' }
        : user.kycStatus === 'rejected'
          ? { label: 'Needs attention', className: 'text-rose-300' }
          : { label: 'Not verified', className: 'text-white/60' };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8">
      {/* Left column - Identity Card (4 columns) */}
      <div className="md:col-span-4">
        <div className="flex flex-col items-center bg-transparent p-0 md:p-6">
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

          <button
            type="button"
            onClick={onCurrencyClick}
            aria-label={`Display currency: ${currency}`}
            className="mt-5 inline-flex min-h-10 items-center gap-2 px-1 text-sm font-medium text-white transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span>{currency}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </button>

          {/* Identity Information */}
          <h3 className="mt-4 text-2xl font-semibold text-center">
            {user.firstName} {user.lastName}
          </h3>
          <p className="mt-2 text-base text-muted-foreground text-center">
            {user.email}
          </p>
          <p className="mt-2 text-sm text-muted-foreground/70 text-center">
            {identityDetailsVerified ? user.country || '—' : null}
          </p>
        </div>
      </div>

      {/* Right column - Information Panel (8 columns) */}
      <div className="md:col-span-8">
        <div className="space-y-2">
          {/* Name */}
          <div className="flex flex-col gap-1.5 px-0 py-3 transition-colors sm:h-16 sm:flex-row sm:items-center sm:gap-0 sm:py-0 md:rounded-lg md:px-4 md:hover:bg-muted/20">
            <span className="w-auto text-base font-medium text-white/50 sm:w-40">Name</span>
            <span className="hidden w-8 text-muted-foreground/30 sm:block">:</span>
            <span className="flex-1 text-xl font-medium">{user.firstName} {user.lastName}</span>
          </div>

          {/* Date of Birth */}
          <div className="flex flex-col gap-1.5 px-0 py-3 transition-colors sm:h-16 sm:flex-row sm:items-center sm:gap-0 sm:py-0 md:rounded-lg md:px-4 md:hover:bg-muted/20">
            <span className="w-auto text-base font-medium text-white/50 sm:w-40">Date of Birth</span>
            <span className="hidden w-8 text-muted-foreground/30 sm:block">:</span>
            <span className="flex-1 text-xl font-medium">
              {identityDetailsVerified ? formatDateOfBirth(user.dateOfBirth) : null}
            </span>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5 px-0 py-3 transition-colors sm:h-16 sm:flex-row sm:items-center sm:gap-0 sm:py-0 md:rounded-lg md:px-4 md:hover:bg-muted/20">
            <span className="w-auto text-base font-medium text-white/50 sm:w-40">Email</span>
            <span className="hidden w-8 text-muted-foreground/30 sm:block">:</span>
            <span className="flex-1 text-xl font-medium">
              {user.email}
            </span>
          </div>

          {/* Identity verification status */}
          <div className="flex flex-col gap-1.5 px-0 py-3 transition-colors sm:h-16 sm:flex-row sm:items-center sm:gap-0 sm:py-0 md:rounded-lg md:px-4 md:hover:bg-muted/20">
            <span className="w-auto text-base font-medium text-white/50 sm:w-40">Identity verification</span>
            <span className="hidden w-8 text-muted-foreground/30 sm:block">:</span>
            <span className={`flex-1 text-base font-medium sm:text-xl ${verificationStatus.className}`}>
              {verificationStatus.label}
            </span>
          </div>

          {/* Country / Region */}
          <div className="flex flex-col gap-1.5 px-0 py-3 transition-colors sm:h-16 sm:flex-row sm:items-center sm:gap-0 sm:py-0 md:rounded-lg md:px-4 md:hover:bg-muted/20">
            <span className="w-auto text-base font-medium text-white/50 sm:w-40">Country</span>
            <span className="hidden w-8 text-muted-foreground/30 sm:block">:</span>
            <span className="flex-1 text-xl font-medium">
              {identityDetailsVerified ? user.country || '—' : null}
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
