'use client';

import { usePathname } from 'next/navigation';
import Header from '../components/Layout/Header/index';
import Footer from '../components/Layout/Footer/index';
import ScrollToTop from '../components/ScrollToTop/index';
import Aoscompo from '../utils/aos';
import { UnifiedProvider } from '../context/UnifiedContext';
import { CryptoPriceProvider } from '../context/CryptoPriceContext';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import ToasterContext from './api/contex/ToasetContex';

function AccountScopedUnifiedProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  return <UnifiedProvider key={userId}>{children}</UnifiedProvider>;
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboardShell = pathname?.startsWith('/dashboard');
  const isCampaignAccessRoute = pathname?.startsWith('/auth/campaign-access');
  const isStandaloneAuthRoute = pathname === '/auth/sign-in' || pathname === '/auth/sign-up';
  const isAdminShell = pathname?.startsWith('/admin');

  const publicContent = (
    <Aoscompo>
      {!isDashboardShell && !isCampaignAccessRoute && <Header />}
      {children}
      {!isDashboardShell && !isCampaignAccessRoute && !isStandaloneAuthRoute && <Footer />}
    </Aoscompo>
  );

  return (
    <AuthProvider>
      {isAdminShell ? children : (
        <CryptoPriceProvider>
          {isDashboardShell || isCampaignAccessRoute ? (
            <AccountScopedUnifiedProvider>
              {publicContent}
            </AccountScopedUnifiedProvider>
          ) : (
            publicContent
          )}
        </CryptoPriceProvider>
      )}
      {!isAdminShell && <ScrollToTop />}
      {!isAdminShell && <ToasterContext />}
    </AuthProvider>
  );
}
