'use client';

import { User, ShieldCheck, HardDrive, KeyRound, Clock, Settings, UserRoundPen } from 'lucide-react';
import type { UnifiedUser } from '@/types/unified';
import { ProfileContent } from './ProfileContent';
import { EditProfileContent } from './EditProfileContent';
import { IDVerificationContent } from './IDVerificationContent';
import { SecurityContent } from './SecurityContent';
import { ChangePasswordContent } from './ChangePasswordContent';
import { ActivityLogContent } from './ActivityLogContent';
import { PreferencesContent } from './PreferencesContent';

interface ContentProps {
  activeTab: string;
  user?: UnifiedUser | null;
}

export default function ProfileDesktopContent({ activeTab, user }: ContentProps) {
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
      return <ProfileContent user={user} />;
    case 'edit':
      return <EditProfileContent user={user} />;
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
    default:
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <p>Select a tab to view content</p>
        </div>
      );
  }
}
