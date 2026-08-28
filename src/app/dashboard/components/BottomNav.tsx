'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Clock, User } from 'lucide-react';

interface BottomNavProps {
  activeTab?: string;
}

export default function BottomNav({ activeTab = 'dashboard' }: BottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    { id: 'dashboard', label: 'Home', href: '/dashboard', icon: LayoutDashboard },
    { id: 'history', label: 'History', href: '/dashboard/history', icon: Clock },
    { id: 'profile', label: 'Profile', href: '/dashboard/profile', icon: User },
  ];

  const isActive = (itemId: string, href: string) => {
    if (itemId === 'dashboard') {
      return activeTab === itemId || pathname === href;
    }

    return activeTab === itemId || pathname === href || pathname?.startsWith(`${href}/`);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-darkmode lg:hidden">
      <div className="flex items-center justify-around h-[72px] pb-safe">
        {navItems.map((item) => {
          const active = isActive(item.id, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`
                flex flex-col items-center justify-center w-full h-full gap-1 transition-colors
                ${active ? 'text-primary' : 'text-charcoalGray hover:text-white'}
              `}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
