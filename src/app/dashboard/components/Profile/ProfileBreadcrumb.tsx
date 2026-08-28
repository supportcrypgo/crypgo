'use client';

import { ChevronRight } from 'lucide-react';

export default function ProfileBreadcrumb() {
  return (
    <nav className="mt-4 flex items-center gap-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
      <span>Crypgo</span>
      <ChevronRight className="w-4 h-4" />
      <span className="font-medium text-foreground">My Profile</span>
    </nav>
  );
}