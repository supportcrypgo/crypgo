'use client';

import { useState, useEffect } from 'react';
import { Bell, Mail, Shield, TrendingUp, Layers, Zap, RotateCcw, Settings, Check } from 'lucide-react';
import type { UnifiedUser } from '@/types/unified';
import { profileApi } from '@/data/api';

interface NotificationPreference {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: 'security' | 'trading' | 'marketing' | 'system';
  defaultEnabled: boolean;
}

const notificationPreferences: NotificationPreference[] = [
  {
    id: 'security_alerts',
    title: 'Security Alerts',
    description: 'Notifications about suspicious logins, password changes, and security events',
    icon: <Shield className="w-5 h-5" />,
    category: 'security',
    defaultEnabled: true,
  },
  {
    id: 'login_alerts',
    title: 'New Login Alerts',
    description: 'Get notified when someone logs into your account from a new device or location',
    icon: <Mail className="w-5 h-5" />,
    category: 'security',
    defaultEnabled: true,
  },
  {
    id: '2fa_alerts',
    title: '2FA Changes',
    description: 'Alerts when two-factor authentication is enabled or disabled',
    icon: <Shield className="w-5 h-5" />,
    category: 'security',
    defaultEnabled: true,
  },
  {
    id: 'transaction_updates',
    title: 'Transaction Updates',
    description: 'Confirmations for deposits, withdrawals, transfers, and trades',
    icon: <Layers className="w-5 h-5" />,
    category: 'trading',
    defaultEnabled: true,
  },
  {
    id: 'price_alerts',
    title: 'Price Alerts',
    description: 'Notifications when your favorite assets reach target prices',
    icon: <Zap className="w-5 h-5" />,
    category: 'trading',
    defaultEnabled: false,
  },
  {
    id: 'weekly_digest',
    title: 'Weekly Digest',
    description: 'Summary of your portfolio performance and market highlights',
    icon: <RotateCcw className="w-5 h-5" />,
    category: 'marketing',
    defaultEnabled: true,
  },
  {
    id: 'marketing_emails',
    title: 'Marketing & Promotions',
    description: 'News about new features, promotions, and platform updates',
    icon: <Bell className="w-5 h-5" />,
    category: 'marketing',
    defaultEnabled: false,
  },
  {
    id: 'system_updates',
    title: 'System Updates',
    description: 'Maintenance windows, API changes, and important platform announcements',
    icon: <Settings className="w-5 h-5" />,
    category: 'system',
    defaultEnabled: true,
  },
];

const categoryColors: Record<string, string> = {
  security: 'bg-red-500/10 text-red-500',
  trading: 'bg-green-500/10 text-green-500',
  marketing: 'bg-purple-500/10 text-purple-500',
  system: 'bg-blue-500/10 text-blue-500',
};

const categoryLabels: Record<string, string> = {
  security: 'Security',
  trading: 'Trading',
  marketing: 'Marketing',
  system: 'System',
};

export function PreferencesContent({ user }: { user: UnifiedUser }) {
  const [preferences, setPreferences] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const prefs = await profileApi.getEmailPreferences();
        if (!mounted) return;
        setPreferences({
          security_alerts: prefs.security_alerts,
          transaction_updates: prefs.portfolio_activity,
          marketing_emails: prefs.marketing,
          weekly_digest: prefs.product_updates,
        });
      } catch {
        if (mounted) setDefaults();
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const setDefaults = () => {
    const defaults: Record<string, boolean> = {};
    notificationPreferences.forEach(p => {
      defaults[p.id] = p.defaultEnabled;
    });
    setPreferences(defaults);
  };

  const togglePreference = async (id: string) => {
    setSaving(prev => ({ ...prev, [id]: true }));
    const newValue = !preferences[id];
    const next = { ...preferences, [id]: newValue };
    setPreferences(next);

    try {
      await profileApi.updateEmailPreferences({
        portfolio_activity: next.transaction_updates ?? false,
        security_alerts: next.security_alerts ?? false,
        product_updates: next.weekly_digest ?? false,
        marketing: next.marketing_emails ?? false,
      });
      setSaved(id);
      setTimeout(() => setSaved(null), 2000);
    } catch {
      setPreferences(preferences);
    } finally {
      setSaving(prev => ({ ...prev, [id]: false }));
    }
  };

  const getCategories = () => {
    const categories: Array<'security' | 'trading' | 'marketing' | 'system'> = [];
    const seen = new Set<string>();

    notificationPreferences.forEach((preference) => {
      if (!seen.has(preference.category)) {
        seen.add(preference.category);
        categories.push(preference.category);
      }
    });

    return categories;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold flex items-center gap-3">
          <Bell className="w-6 h-6" />
          Notification Preferences
        </h2>
        <p className="mt-2 text-muted-foreground">
          Choose what notifications you want to receive and how. Changes save automatically.
        </p>
      </div>

      {/* Save Indicator */}
      {saved && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm">
            <Check className="w-4 h-4" />
            {saved} preference saved
          </div>
        </div>
      )}

      {/* Preferences by Category */}
      {getCategories().map(category => {
        const categoryPrefs = notificationPreferences.filter(p => p.category === category);
        return (
          <div key={category} className="space-y-4">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${categoryColors[category]}`}>
                {categoryLabels[category]}
              </span>
              <div className="h-px flex-1 bg-white/5" />
            </div>
            {categoryPrefs.map(pref => (
              <div key={pref.id} className="p-0 rounded-none bg-transparent border-0 md:p-4 md:rounded-xl md:bg-muted/20 md:border md:border-white/5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary">
                      {pref.icon}
                    </div>
                    <div>
                      <h4 className="font-medium">{pref.title}</h4>
                      <p className="text-sm text-muted-foreground">{pref.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => togglePreference(pref.id)}
                    disabled={saving[pref.id]}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      preferences[pref.id] ? 'bg-primary' : 'bg-muted'
                    } disabled:opacity-50`}
                    role="switch"
                    aria-checked={preferences[pref.id]}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        preferences[pref.id] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {/* Email Frequency */}
      <div className="p-0 rounded-none bg-transparent border-0 md:p-6 md:rounded-xl md:bg-muted/20 md:border md:border-white/5">
        <h3 className="font-semibold mb-4">Email Frequency</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Control how often you receive digest emails
        </p>
        <div className="space-y-3">
          <label className="flex flex-col gap-2 cursor-pointer sm:flex-row sm:items-center sm:gap-3">
            <input type="radio" name="email_frequency" defaultChecked className="w-4 h-4 accent-primary" />
            <span className="text-sm">Real-time (instant)</span>
            <span className="text-xs text-muted-foreground sm:ml-auto">Receive emails immediately when events occur</span>
          </label>
          <label className="flex flex-col gap-2 cursor-pointer sm:flex-row sm:items-center sm:gap-3">
            <input type="radio" name="email_frequency" className="w-4 h-4 accent-primary" />
            <span className="text-sm">Hourly digest</span>
            <span className="text-xs text-muted-foreground sm:ml-auto">Receive a summary every hour</span>
          </label>
          <label className="flex flex-col gap-2 cursor-pointer sm:flex-row sm:items-center sm:gap-3">
            <input type="radio" name="email_frequency" className="w-4 h-4 accent-primary" />
            <span className="text-sm">Daily digest</span>
            <span className="text-xs text-muted-foreground sm:ml-auto">Receive one summary per day</span>
          </label>
          <label className="flex flex-col gap-2 cursor-pointer sm:flex-row sm:items-center sm:gap-3">
            <input type="radio" name="email_frequency" className="w-4 h-4 accent-primary" />
            <span className="text-sm">Weekly digest</span>
            <span className="text-xs text-muted-foreground sm:ml-auto">Receive one summary per week</span>
          </label>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="p-0 rounded-none bg-transparent border-0 md:p-6 md:rounded-xl md:bg-gradient-to-br md:from-primary/10 md:to-primary/5 md:border md:border-primary/20">
        <h3 className="font-semibold mb-2">Your Privacy Matters</h3>
        <p className="text-sm text-muted-foreground">
          We respect your inbox. You can unsubscribe from marketing emails at any time using the link at the bottom of each email. 
          Security and transactional emails cannot be disabled as they are essential for your account safety.
        </p>
      </div>
    </div>
  );
}
