'use client';

import {
  User,
  UserRoundPen,
  Phone,
  ShieldCheck,
  KeyRound,
  Clock,
  LogOut,
  ChevronRight,
} from 'lucide-react';

interface ActionItem {
  icon: React.ReactNode;
  label: string;
  tab: string;
}

interface ProfileActionsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout?: () => void;
}

export default function ProfileActions({ activeTab, onTabChange, onLogout }: ProfileActionsProps) {
  const actions: ActionItem[] = [
    { icon: <User className="w-5 h-5" />, label: 'Profile', tab: 'profile' },
    { icon: <UserRoundPen className="w-5 h-5" />, label: 'Edit Profile', tab: 'edit' },
    { icon: <Phone className="w-5 h-5" />, label: 'Phone Verification', tab: 'profile' },
    { icon: <ShieldCheck className="w-5 h-5" />, label: 'ID Verification', tab: 'id-verify' },
    { icon: <KeyRound className="w-5 h-5" />, label: 'Reset Password', tab: 'password' },
    { icon: <Clock className="w-5 h-5" />, label: 'Activity Log', tab: 'activity' },
  ];

  return (
    <div className="w-full">
      <div className="overflow-visible bg-transparent md:overflow-hidden md:rounded-2xl md:border md:border-muted md:bg-card/50">
        {actions.map((action, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onTabChange(action.tab)}
            className={`
              flex w-full items-center h-[76px] px-5 text-left
              hover:bg-muted/30 transition-colors
              ${activeTab === action.tab ? 'bg-muted/20' : ''}
              ${index !== actions.length - 1 ? 'md:border-b md:border-muted/50' : ''}
            `}
            aria-pressed={activeTab === action.tab}
          >
            {/* Icon column - consistent position */}
            <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center text-muted-foreground">
              {action.icon}
            </div>

            {/* Label column */}
            <span className="ml-4 text-base font-medium">{action.label}</span>

            {/* Chevron - right anchored */}
            <ChevronRight className="w-5 h-5 text-muted-foreground/50 ml-auto" />
          </button>
        ))}

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center h-[76px] px-5 text-left hover:bg-muted/30 transition-colors md:border-t md:border-muted/50"
          >
            <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center text-muted-foreground">
              <LogOut className="w-5 h-5" />
            </div>
            <span className="ml-4 text-base font-medium">Log out</span>
            <ChevronRight className="w-5 h-5 text-muted-foreground/50 ml-auto" />
          </button>
        )}
      </div>
    </div>
  );
}
