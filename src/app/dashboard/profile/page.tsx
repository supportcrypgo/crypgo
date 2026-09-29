'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import ProfileHeader from '@/app/dashboard/components/Profile/ProfileHeader';
import ProfileIdentity from '@/app/dashboard/components/Profile/ProfileIdentity';
import ProfileActions from '@/app/dashboard/components/Profile/ProfileActions';
import ProfileDesktopContent from '@/app/dashboard/components/Profile/ProfileDesktopContent';
import ProfileDesktopWorkspace from '@/app/dashboard/components/Profile/ProfileDesktopWorkspace';
import DesktopSidebar, { SIDEBAR_OFFSET_CLASS } from '@/app/dashboard/components/DesktopSidebar';
import DesktopHeader from '@/app/dashboard/components/DesktopHeader';
import BottomNav from '@/app/dashboard/components/BottomNav';
import { useAuth } from '@/hooks/useAuth';

type ProfileSection =
  | 'profile'
  | 'id-verify'
  | 'security'
  | 'password'
  | 'activity'
  | 'preferences'
  | 'delete-account';

export default function ProfilePage() {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [mobileSection, setMobileSection] = useState<ProfileSection | null>(null);
  const mobileContentRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();

  const setSection = (tab: ProfileSection | null) => {
    const params = new URLSearchParams(searchParams.toString());

    if (tab && tab !== 'profile') {
      params.set('tab', tab);
    } else {
      params.delete('tab');
    }

    const queryString = params.toString();
    router.replace(queryString ? `/dashboard/profile?${queryString}` : '/dashboard/profile', {
      scroll: false,
    });

    setMobileSection(tab);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const requestedTab = searchParams.get('tab') as ProfileSection | null;
    const validTabs: ProfileSection[] = [
      'profile',
      'id-verify',
      'security',
      'password',
      'activity',
      'preferences',
      'delete-account',
    ];

    if (requestedTab && validTabs.includes(requestedTab)) {
      setMobileSection(requestedTab);
    } else {
      setMobileSection(null);
    }
  }, [searchParams]);

  useEffect(() => {
    mobileContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [mobileSection]);

  // Prevent flash of mobile layout on desktop — wait for client-side hydration
  if (!mounted) {
    return null;
  }

  if (isDesktop) {
    return (
      <div className="min-h-screen bg-darkmode text-white">
        {/* Sidebar */}
        <DesktopSidebar />

        {/* Main workspace */}
        <div className={SIDEBAR_OFFSET_CLASS}>
          {/* Desktop Header */}
          <DesktopHeader title="Profile" />

          {/* Main content */}
          <main className="px-7 pt-6 pb-10">
            <ProfileDesktopWorkspace user={user} />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-darkmode text-white flex flex-col overflow-hidden">
      <div className="sticky top-0 z-40 bg-darkmode/95 backdrop-blur-md">
        <div className="max-w-md mx-auto px-6 pt-safe-top">
          <ProfileHeader
            showBackButton={mobileSection !== null}
            onBackClick={() => setSection(null)}
          />
        </div>
      </div>

      <main ref={mobileContentRef} className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-6 pt-6 pb-28">
          {mobileSection === null ? (
            <>
              <ProfileIdentity user={user} />
              <div className="mt-12">
                <ProfileActions
                  activeTab=""
                  onTabChange={(tab) => setSection(tab as ProfileSection)}
                  onLogout={logout}
                />
              </div>
            </>
          ) : (
            <section className="w-full">
              <ProfileDesktopContent activeTab={mobileSection} user={user} />
            </section>
          )}
        </div>
      </main>

      <BottomNav activeTab="profile" />
    </div>
  );
}
