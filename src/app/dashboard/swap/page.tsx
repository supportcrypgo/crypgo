'use client';

export const dynamic = 'force-dynamic';

import React from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import MobileHeader from '@/app/dashboard/components/MobileHeader';
import BottomNav from '@/app/dashboard/components/BottomNav';
import DesktopSidebar, { SIDEBAR_OFFSET_CLASS } from '@/app/dashboard/components/DesktopSidebar';
import DesktopHeader from '@/app/dashboard/components/DesktopHeader';
import { SwapWorkspace } from '@/app/dashboard/components/SwapWorkspace';

export default function SwapPage() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [showSuccessPage, setShowSuccessPage] = React.useState(false);
  const [successDetails, setSuccessDetails] = React.useState<{
    fromAmount: string;
    fromTicker: string;
    fromLogo: string;
    toAmount: string;
    toTicker: string;
    toLogo: string;
  } | null>(null);

  const handleOk = () => {
    setShowSuccessPage(false);
    setSuccessDetails(null);
    window.location.href = '/dashboard';
  };

  if (!isDesktop && showSuccessPage && successDetails) {
    const exchangeText = `${Number(successDetails.fromAmount).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${successDetails.fromTicker} for ${Number(successDetails.toAmount).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${successDetails.toTicker}`;

    return (
      <div className="fixed inset-0 z-50 bg-[#070b14] px-4 pb-6 pt-0">
        <div className="flex h-full flex-col">
          <div className="flex flex-1 items-center justify-center">
            {isDesktop ? (
              <div className="flex flex-col items-center justify-center text-center">
                <div className="flex items-center justify-center gap-2">
                  <img
                    src={successDetails.fromLogo}
                    alt={successDetails.fromTicker}
                    className="h-12 w-12 rounded-full border border-white/10 bg-white/5 shadow-lg shadow-primary/10"
                  />
                  <img
                    src={successDetails.toLogo}
                    alt={successDetails.toTicker}
                    className="h-12 w-12 rounded-full border border-white/10 bg-white/5 shadow-lg shadow-primary/10"
                  />
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white leading-none">{exchangeText}</h2>
                <p className="mt-3 max-w-[260px] text-sm leading-5 text-charcoalGray">Swap completed successfully</p>
              </div>
            ) : (
              <div className="flex w-full max-w-[320px] flex-col items-center text-center">
                <div className="flex items-center justify-center gap-2">
                  <img src={successDetails.fromLogo} alt={successDetails.fromTicker} className="h-14 w-14 rounded-full" />
                  <img src={successDetails.toLogo} alt={successDetails.toTicker} className="h-14 w-14 rounded-full" />
                </div>
                <p className="mt-6 text-lg font-semibold tracking-tight text-white">{exchangeText}</p>
                <p className="mt-2 text-sm text-charcoalGray">Swap completed successfully</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleOk}
            className="w-full h-[52px] bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    );
  }

  // Mobile view
  if (!isDesktop) {
    return (
      <div className="min-h-screen bg-darkmode bg-cover bg-top bg-no-repeat">
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
        <main className="px-5 pt-0 pb-[88px] min-h-[calc(100vh-80px)]">
          <SwapWorkspace
            onSuccessPageChange={setShowSuccessPage}
            onSuccessDetailsChange={setSuccessDetails}
          />
        </main>
        
        {/* Mobile Bottom Nav */}
        <BottomNav activeTab="swap" hidden={showSuccessPage} />
      </div>
    );
  }

  // Desktop view
  return (
    <div className="min-h-screen bg-darkmode bg-cover bg-top bg-no-repeat">
      {/* Desktop Sidebar */}
      <DesktopSidebar />
      
      {/* Main workspace */}
      <div className={SIDEBAR_OFFSET_CLASS}>
        {/* Desktop Header */}
        <DesktopHeader title="Swap" />
        
        {/* Main Content */}
        <main className="px-7 pt-6 pb-10 min-h-[calc(100vh-80px)]">
          <SwapWorkspace
            onSuccessPageChange={setShowSuccessPage}
            onSuccessDetailsChange={setSuccessDetails}
          />
        </main>
      </div>
    </div>
  );
}
