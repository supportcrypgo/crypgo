'use client';

import { usePathname } from 'next/navigation';
import Header from '../components/Layout/Header/index';
import Footer from '../components/Layout/Footer/index';
import ScrollToTop from '../components/ScrollToTop/index';
import Aoscompo from '../utils/aos';
import { UnifiedProvider } from '../context/UnifiedContext';
import { CryptoPriceProvider } from '../context/CryptoPriceContext';
import { AuthProvider } from '../hooks/useAuth';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboardShell = pathname?.startsWith('/dashboard');
  const isCampaignAccessRoute = pathname?.startsWith('/auth/campaign-access');
  const isAdminShell = pathname?.startsWith('/admin');

  return (
    <CryptoPriceProvider>
      {isAdminShell ? (
        <>
          {children}
        </>
      ) : (
        <AuthProvider>
          <UnifiedProvider>
            <Aoscompo>
              {!isDashboardShell && !isCampaignAccessRoute && <Header />}
              {children}
              {!isDashboardShell && !isCampaignAccessRoute && <Footer />}
            </Aoscompo>
            <ScrollToTop />
          </UnifiedProvider>
        </AuthProvider>
      )}
    </CryptoPriceProvider>
  );
}
