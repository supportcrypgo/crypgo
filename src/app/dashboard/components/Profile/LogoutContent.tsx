'use client';

import Link from 'next/link';
import { ChevronRight, LogOut, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function LogoutContent() {
  const { logout } = useAuth();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Log out</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Choose whether to sign out of Crypgo or continue to account deletion.
        </p>
      </div>

      <button
        type="button"
        onClick={() => void logout()}
        className="flex min-h-[76px] w-full items-center gap-4 px-5 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-muted-foreground">
          <LogOut className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="flex-1">
          <span className="block text-base font-medium text-white">Log out</span>
          <span className="mt-1 block text-sm text-muted-foreground">Sign out of your account on this device.</span>
        </span>
        <ChevronRight className="h-5 w-5 text-muted-foreground/50" aria-hidden="true" />
      </button>

      <Link
        href="/dashboard/profile?tab=delete-account"
        className="flex min-h-[76px] w-full items-center gap-4 px-5 text-left transition-colors hover:bg-red-500/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-500/10 text-red-400">
          <Trash2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="flex-1">
          <span className="block text-base font-medium text-red-300">Delete Account</span>
          <span className="mt-1 block text-sm text-muted-foreground">Review the permanent account deletion process.</span>
        </span>
        <ChevronRight className="h-5 w-5 text-red-300/60" aria-hidden="true" />
      </Link>
    </div>
  );
}
