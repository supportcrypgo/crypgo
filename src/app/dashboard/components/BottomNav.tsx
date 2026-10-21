'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Copy, Globe, Headset, Send, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface BottomNavProps {
  activeTab?: string;
  hidden?: boolean;
}

export default function BottomNav({ activeTab = 'dashboard', hidden = false }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  if (hidden) return null;

  const publicSiteUrl = 'https://crypgo.us.ci';
  const supportHref = 'mailto:support@crypgo.us.ci?subject=Talk%20to%20Crypgo%20Support';
  const shareMessage = `Join me on Crypgo — explore the platform, manage your crypto, and discover ways to earn in crypto. ${publicSiteUrl}`;

  const handleWebsite = async () => {
    await logout({ redirect: false });
    window.location.assign(publicSiteUrl);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Crypgo',
          text: shareMessage,
          url: publicSiteUrl,
        });
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          toast.error('Unable to open the share menu.');
        }
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareMessage);
      toast.success('Invitation copied. Share it with your friends.');
    } catch {
      toast.error('Sharing is not available on this device.');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicSiteUrl);
      toast.success('Crypgo link copied.');
    } catch {
      toast.error('Unable to copy the Crypgo link.');
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Home', href: '/dashboard' },
    { id: 'cards', label: 'Cards', href: '/dashboard/cards' },
    { id: 'history', label: 'History', href: '/dashboard/history' },
    { id: 'profile', label: 'Profile', href: '/dashboard/profile' },
  ];
  const socialItems = [
    { label: 'Go to crypgo.us.ci and sign out', icon: Globe, onClick: handleWebsite },
    { label: 'Share Crypgo', icon: Share2, onClick: handleShare },
    { label: 'Send crypto', icon: Send, onClick: () => router.push('/dashboard/wallet/send') },
    { label: 'Talk to support', icon: Headset, href: supportHref },
    { label: 'Copy Crypgo link', icon: Copy, onClick: handleCopyLink },
  ];

  const isActive = (itemId: string, href: string) => {
    if (itemId === 'dashboard') {
      return activeTab === itemId || pathname === href;
    }

    return activeTab === itemId || pathname === href || pathname?.startsWith(`${href}/`);
  };

  return (
    <nav
      aria-label="Dashboard"
      className="fixed inset-x-0 bottom-0 z-50 bg-darkmode/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto max-w-xl px-2">
        <div className="flex h-10 items-center justify-end gap-4">
          {navItems.map((item) => {
            const active = isActive(item.id, item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`relative flex h-full items-center text-[13px] transition-colors ${
                  active ? 'font-medium text-primary' : 'text-white/65 hover:text-white'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex h-8 items-center justify-between gap-2">
          <span className="whitespace-nowrap text-[10px] tracking-tight text-white/40">
            © 2026 Crypgo, All rights reserved
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            {socialItems.map(({ label, icon: Icon, onClick, href }) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                title={label}
                onClick={href ? () => window.location.assign(href) : onClick}
                className="flex h-6 w-6 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
