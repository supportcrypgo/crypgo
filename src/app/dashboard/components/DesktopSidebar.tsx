'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Clock,
  User,
  LogOut,
  Wallet,
  Send,
  ArrowDownLeft,
  RefreshCw,
} from 'lucide-react';

export const SIDEBAR_WIDTH = 256;
export const SIDEBAR_OFFSET_CLASS = 'lg:pl-[256px]';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
}

const navItems: SidebarItem[] = [
  { id: 'history', label: 'History', icon: <Clock className="w-5 h-5" />, href: '/dashboard/history' },
  { id: 'profile', label: 'Profile', icon: <User className="w-5 h-5" />, href: '/dashboard/profile' },
];

const homeItem: SidebarItem = {
  id: 'dashboard',
  label: 'Home',
  icon: <LayoutDashboard className="w-5 h-5" />,
  href: '/dashboard',
};

const walletItems: SidebarItem[] = [
  { id: 'send', label: 'Send', icon: <Send className="w-4 h-4" />, href: '/dashboard/wallet/send' },
  { id: 'receive', label: 'Receive', icon: <ArrowDownLeft className="w-4 h-4" />, href: '/dashboard/wallet/receive' },
  { id: 'swap', label: 'Swap', icon: <RefreshCw className="w-4 h-4" />, href: '/dashboard/swap' },
];

export default function DesktopSidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href;
    }

    return pathname === href || pathname?.startsWith(href + '/');
  };

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-[256px] bg-darkmode border-r border-deepSlate z-50">
      {/* Brand / Logo - 20-24px top padding */}
      <div className="h-[72px] flex items-center px-6 pt-5">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Image
            src="/images/logo/logo.svg"
            alt="Crypgo"
            width={195}
            height={55}
            className="h-auto w-[128px]"
            priority
          />
        </Link>
      </div>

      {/* Navigation - 48-52px row height, 16-20px left padding */}
      <nav className="flex-1 py-6 px-5 space-y-1">
        <Link
          href={homeItem.href}
          className={`mb-2 w-full flex items-center gap-3 px-5 py-3 rounded-xl transition-all text-sm ${
            isActive(homeItem.href)
              ? 'bg-deepSlate text-primary font-semibold'
              : 'text-charcoalGray hover:text-white hover:bg-deepSlate/50'
          }`}
        >
          {homeItem.icon}
          <span>{homeItem.label}</span>
        </Link>

        <div className="mb-2 flex items-center gap-2 px-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-charcoalGray/70">
          <Wallet className="w-4 h-4" />
          <span>Wallet</span>
        </div>

        <div className="space-y-1">
          {walletItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`w-full flex items-center gap-3 pl-9 pr-5 py-2.5 rounded-xl transition-all text-sm ${
                  active
                    ? 'bg-deepSlate text-primary font-semibold'
                    : 'text-charcoalGray hover:text-white hover:bg-deepSlate/50'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`w-full flex items-center gap-3 px-5 py-3 rounded-xl transition-all text-sm ${
                active
                  ? 'bg-deepSlate text-primary font-semibold'
                  : 'text-charcoalGray hover:text-white hover:bg-deepSlate/50'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout - pinned to bottom with 24-32px separation */}
      <div className="px-5 pb-6 pt-8">
        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-3 px-5 py-3 rounded-xl text-sm text-charcoalGray hover:text-white hover:bg-deepSlate/50 transition-all"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}