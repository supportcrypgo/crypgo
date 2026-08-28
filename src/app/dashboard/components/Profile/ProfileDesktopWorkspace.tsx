'use client';

import { useState } from 'react';
import ProfileDesktopNav from './ProfileDesktopNav';
import ProfileDesktopContent from './ProfileDesktopContent';
import type { UnifiedUser } from '@/types/unified';

interface DesktopWorkspaceProps {
  user?: UnifiedUser | null;
}

export default function ProfileDesktopWorkspace({ user }: DesktopWorkspaceProps) {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="w-full">
      {/* Navigation Layer */}
      <div className="px-8 pt-6">
        <ProfileDesktopNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Divider */}
      <div className="mt-4 border-t border-muted/50" />

      {/* Content Layer */}
      <div className="p-8">
        <ProfileDesktopContent activeTab={activeTab} user={user} />
      </div>
    </div>
  );
}
