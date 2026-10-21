'use client';

import type { UnifiedUser } from '@/types/unified';
import { ProfileContent } from './ProfileContent';
import { IDVerificationContent } from './IDVerificationContent';
import { SecurityContent } from './SecurityContent';
import { ChangePasswordContent } from './ChangePasswordContent';
import { ActivityLogContent } from './ActivityLogContent';
import { PreferencesContent } from './PreferencesContent';
import { DeleteAccountContent } from './DeleteAccountContent';
import { LogoutContent } from './LogoutContent';
import CurrencyContent from './CurrencyContent';

interface ContentProps {
  activeTab: string;
  user?: UnifiedUser | null;
  onCurrencyClick: () => void;
  onCurrencySelected: () => void;
}

export default function ProfileDesktopContent({
  activeTab,
  user,
  onCurrencyClick,
  onCurrencySelected,
}: ContentProps) {
  if (!user) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No profile data available.</p>
      </div>
    );
  }

  // Render different content based on active tab
  switch (activeTab) {
    case 'profile':
      return <ProfileContent user={user} onCurrencyClick={onCurrencyClick} />;
    case 'id-verify':
      return <IDVerificationContent user={user} />;
    case 'security':
      return <SecurityContent user={user} />;
    case 'password':
      return <ChangePasswordContent user={user} />;
    case 'activity':
      return <ActivityLogContent user={user} />;
    case 'preferences':
      return <PreferencesContent user={user} />;
    case 'currency':
      return <CurrencyContent onCurrencySelected={onCurrencySelected} />;
    case 'delete-account':
      return <DeleteAccountContent />;
    case 'logout':
      return <LogoutContent />;
    default:
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <p>Select a tab to view content</p>
        </div>
      );
  }
}
