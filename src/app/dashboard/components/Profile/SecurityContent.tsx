'use client';

import { useState } from 'react';
import { Shield, Lock, Smartphone, Mail, Bell, CheckCircle, AlertCircle } from 'lucide-react';
import type { UnifiedUser } from '@/types/unified';

interface SecurityItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  type: 'toggle' | 'action' | 'status';
  actionLabel?: string;
  onAction?: () => void;
}

export function SecurityContent({ user }: { user: UnifiedUser }) {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [loginAlerts, setLoginAlerts] = useState(true);

  const securityItems: SecurityItem[] = [
    {
      id: '2fa',
      title: 'Two-Factor Authentication (2FA)',
      description: 'Add an extra layer of security with authenticator app',
      icon: <Shield className="w-5 h-5" />,
      enabled: twoFactorEnabled,
      type: 'toggle',
    },
    {
      id: 'password',
      title: 'Change Password',
      description: 'Update your password regularly for security',
      icon: <Lock className="w-5 h-5" />,
      enabled: true,
      type: 'action',
      actionLabel: 'Change Password',
      onAction: () => console.log('Navigate to change password'),
    },
    {
      id: 'sessions',
      title: 'Active Sessions',
      description: 'Review and manage your active login sessions',
      icon: <Smartphone className="w-5 h-5" />,
      enabled: true,
      type: 'action',
      actionLabel: 'View Sessions',
      onAction: () => console.log('Navigate to sessions'),
    },
    {
      id: 'email_notifications',
      title: 'Email Notifications',
      description: 'Receive important account updates via email',
      icon: <Mail className="w-5 h-5" />,
      enabled: emailNotifications,
      type: 'toggle',
    },
    {
      id: 'sms_notifications',
      title: 'SMS Notifications',
      description: 'Receive security alerts via SMS',
      icon: <Smartphone className="w-5 h-5" />,
      enabled: smsNotifications,
      type: 'toggle',
    },
    {
      id: 'login_alerts',
      title: 'New Login Alerts',
      description: 'Get notified when someone logs into your account',
      icon: <Bell className="w-5 h-5" />,
      enabled: loginAlerts,
      type: 'toggle',
    },
  ];

  const renderItem = (item: SecurityItem) => (
    <div key={item.id} className="p-0 bg-transparent md:p-4 md:rounded-xl md:bg-muted/20 md:border md:border-white/5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-primary/10 text-primary">
            {item.icon}
          </div>
          <div>
            <h4 className="font-medium">{item.title}</h4>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </div>
        </div>

        {item.type === 'toggle' && (
          <button
            onClick={() => {
              if (item.id === '2fa') setTwoFactorEnabled(!twoFactorEnabled);
              else if (item.id === 'email_notifications') setEmailNotifications(!emailNotifications);
              else if (item.id === 'sms_notifications') setSmsNotifications(!smsNotifications);
              else if (item.id === 'login_alerts') setLoginAlerts(!loginAlerts);
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              item.enabled ? 'bg-primary' : 'bg-muted'
            }`}
            role="switch"
            aria-checked={item.enabled}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                item.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        )}

        {item.type === 'action' && (
          <button
            onClick={item.onAction}
            className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary/10 transition-colors"
          >
            {item.actionLabel}
          </button>
        )}

        {item.type === 'status' && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
            <CheckCircle className="w-3 h-3" />
            Active
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold">Security Settings</h2>
        <p className="mt-2 text-muted-foreground">
          Manage your account security, authentication methods, and notification preferences.
        </p>
      </div>

      {/* Security Score */}
      <div className="p-0 rounded-none bg-transparent border-0 md:p-6 md:rounded-xl md:bg-gradient-to-br md:from-primary/10 md:to-primary/5 md:border md:border-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Security Score</h3>
            <p className="text-sm text-muted-foreground">Strengthen your account protection</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary">85%</div>
            <p className="text-sm text-muted-foreground">Good</p>
          </div>
        </div>
        <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full transition-all duration-500" 
            style={{ width: '85%' }}
          />
        </div>
        <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">{twoFactorEnabled ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-yellow-500" />} 2FA</span>
          <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4 text-green-500" /> Password</span>
          <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4 text-green-500" /> Email</span>
          <span className="flex items-center gap-1">{smsNotifications ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-yellow-500" />} SMS</span>
        </div>
      </div>

      {/* Security Items */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Authentication</h3>
        {securityItems.filter(i => ['2fa', 'password', 'sessions'].includes(i.id)).map(renderItem)}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Notifications</h3>
        {securityItems.filter(i => ['email_notifications', 'sms_notifications', 'login_alerts'].includes(i.id)).map(renderItem)}
      </div>

      {/* Security Tips */}
      <div className="p-0 rounded-none bg-transparent border-0 md:p-6 md:rounded-xl md:bg-muted/20 md:border md:border-white/5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Security Recommendations
        </h3>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span>Enable 2FA for the highest level of account protection</span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span>Use a unique, strong password you don't use elsewhere</span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span>Review active sessions regularly and revoke unknown devices</span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span>Keep login alerts enabled to detect unauthorized access</span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span>Never share your 2FA codes, passwords, or API keys with anyone</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
