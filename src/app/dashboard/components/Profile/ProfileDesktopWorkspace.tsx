'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import ProfileDesktopNav from './ProfileDesktopNav';
import ProfileDesktopContent from './ProfileDesktopContent';
import type { UnifiedUser } from '@/types/unified';

interface DesktopWorkspaceProps {
  user?: UnifiedUser | null;
}

export default function ProfileDesktopWorkspace({ user }: DesktopWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    const requestedTab = searchParams.get('tab') || 'profile';
    const validTabs = [
      'profile',
      'id-verify',
      'security',
      'password',
      'activity',
      'preferences',
      'delete-account',
    ];

    setActiveTab(validTabs.includes(requestedTab) ? requestedTab : 'profile');
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    const next = new URLSearchParams(searchParams.toString());

    if (tab === 'profile') {
      next.delete('tab');
    } else {
      next.set('tab', tab);
    }

    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    setActiveTab(tab);
  };

  return (
    <div className="w-full">
      {/* Navigation Layer */}
      <div className="px-8 pt-6">
        <ProfileDesktopNav activeTab={activeTab} onTabChange={handleTabChange} />
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
