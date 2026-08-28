'use client';

export const dynamic = 'force-dynamic';

import React from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import MobileHeader from '@/app/dashboard/components/MobileHeader';
import BottomNav from '@/app/dashboard/components/BottomNav';
import DesktopSidebar, { SIDEBAR_OFFSET_CLASS } from '@/app/dashboard/components/DesktopSidebar';
import DesktopHeader from '@/app/dashboard/components/DesktopHeader';
import CautionModalGate from '@/components/Auth/CautionModalGate';
import { SwapWorkspace } from '@/app/dashboard/components/SwapWorkspace';

export default function SwapPage() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Mobile view
  if (!isDesktop) {
    return (
      <div className="min-h-screen bg-darkmode">
        <CautionModalGate />
        {/* Mobile Header */}
        <MobileHeader 
          title="Swap" 
          onMenuClick={() => console.log('Menu clicked')}
          showMenuButton={false}
          showBackButton
          backHref="/dashboard"
          backLabel="Back to dashboard"
        />
        
        {/* Main Content */}
        <main className="px-5 pt-4 pb-[88px]">
          <SwapWorkspace />
        </main>
        
        {/* Mobile Bottom Nav */}
        <BottomNav activeTab="swap" />
      </div>
    );
  }

  // Desktop view
  return (
    <div className="min-h-screen bg-darkmode">
      <CautionModalGate />
      {/* Desktop Sidebar */}
      <DesktopSidebar />
      
      {/* Main workspace */}
      <div className={SIDEBAR_OFFSET_CLASS}>
        {/* Desktop Header */}
        <DesktopHeader title="Swap" />
        
        {/* Main Content */}
        <main className="px-7 pt-6 pb-10">
          <SwapWorkspace />
        </main>
      </div>
    </div>
  );
}
