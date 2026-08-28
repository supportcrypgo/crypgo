'use client';

import {
  User,
  UserRoundPen,
  ShieldCheck,
  KeyRound,
  Clock,
  Settings,
  HardDrive,
} from 'lucide-react';

interface NavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
}

interface DesktopNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function ProfileDesktopNav({ activeTab, onTabChange }: DesktopNavProps) {
  const navItems: NavItem[] = [
    { id: 'profile', icon: <User className="w-5 h-5" />, label: 'Profile' },
    { id: 'edit', icon: <UserRoundPen className="w-5 h-5" />, label: 'Edit Profile' },
    { id: 'id-verify', icon: <ShieldCheck className="w-5 h-5" />, label: 'ID Verification' },
    { id: 'security', icon: <HardDrive className="w-5 h-5" />, label: 'Security' },
    { id: 'password', icon: <KeyRound className="w-5 h-5" />, label: 'Change Password' },
    { id: 'activity', icon: <Clock className="w-5 h-5" />, label: 'Activity Log' },
    { id: 'preferences', icon: <Settings className="w-5 h-5" />, label: 'Preferences' },
  ];

  return (
    <nav className="flex items-center gap-8 h-[72px]" aria-label="Profile navigation">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onTabChange(item.id)}
          className={`
            flex items-center gap-2 px-1 h-full
            text-sm font-medium transition-colors
            ${
              activeTab === item.id
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }
          `}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  );
}
