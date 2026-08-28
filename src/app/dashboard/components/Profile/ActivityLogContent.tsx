'use client';

import { useEffect, useState } from 'react';
import { Monitor, Smartphone, Tablet, MapPin, Globe, Loader2, XCircle, CheckCircle, AlertCircle, LogOut, Trash2, Clock } from 'lucide-react';
import type { UnifiedUser } from '@/types/unified';
import { adminActivityApi, sessionApi, type UserActivityLog } from '@/data/api';

interface ActivityLog {
  id: string;
  type: 'login' | 'logout' | 'password_change' | 'email_change' | 'phone_change' | '2fa_enabled' | '2fa_disabled' | 'api_key_created' | 'api_key_revoked' | 'kyc_submitted' | 'kyc_approved' | 'kyc_rejected';
  timestamp: string;
  ip: string;
  location: string;
  device: string;
  browser: string;
  status: 'success' | 'failed' | 'suspicious';
  details?: string;
}

interface DeviceSession {
  id: string;
  device: string;
  browser: string;
  os: string;
  ip: string;
  location: string;
  lastActive: string;
  current: boolean;
}

const getTypeIcon = (type: ActivityLog['type']) => {
  switch (type) {
    case 'login': return <LogOut className="w-4 h-4" />;
    case 'logout': return <LogOut className="w-4 h-4" />;
    case 'password_change': return <CheckCircle className="w-4 h-4" />;
    case 'email_change': return <Globe className="w-4 h-4" />;
    case 'phone_change': return <Smartphone className="w-4 h-4" />;
    case '2fa_enabled': return <CheckCircle className="w-4 h-4" />;
    case '2fa_disabled': return <XCircle className="w-4 h-4" />;
    case 'api_key_created': return <CheckCircle className="w-4 h-4" />;
    case 'api_key_revoked': return <XCircle className="w-4 h-4" />;
    case 'kyc_submitted': return <Loader2 className="w-4 h-4 animate-spin" />;
    case 'kyc_approved': return <CheckCircle className="w-4 h-4" />;
    case 'kyc_rejected': return <XCircle className="w-4 h-4" />;
  }
};

const getTypeLabel = (type: ActivityLog['type']) => {
  const labels: Record<ActivityLog['type'], string> = {
    login: 'Login',
    logout: 'Logout',
    password_change: 'Password Changed',
    email_change: 'Email Changed',
    phone_change: 'Phone Changed',
    '2fa_enabled': '2FA Enabled',
    '2fa_disabled': '2FA Disabled',
    api_key_created: 'API Key Created',
    api_key_revoked: 'API Key Revoked',
    kyc_submitted: 'KYC Submitted',
    kyc_approved: 'KYC Approved',
    kyc_rejected: 'KYC Rejected',
  };
  return labels[type];
};

const getStatusIcon = (status: ActivityLog['status']) => {
  switch (status) {
    case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
    case 'suspicious': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
  }
};

const getStatusLabel = (status: ActivityLog['status']) => {
  switch (status) {
    case 'success': return 'Success';
    case 'failed': return 'Failed';
    case 'suspicious': return 'Suspicious';
  }
};

const getStatusColor = (status: ActivityLog['status']) => {
  switch (status) {
    case 'success': return 'bg-green-500/10 text-green-500';
    case 'failed': return 'bg-red-500/10 text-red-500';
    case 'suspicious': return 'bg-yellow-500/10 text-yellow-500';
  }
};

const getDeviceIcon = (device: string) => {
  if (device.includes('iPhone') || device.includes('Android')) return <Smartphone className="w-5 h-5" />;
  if (device.includes('iPad') || device.includes('Tablet')) return <Tablet className="w-5 h-5" />;
  return <Monitor className="w-5 h-5" />;
};

export function ActivityLogContent({ user }: { user: UnifiedUser }) {
  const [activeTab, setActiveTab] = useState<'activity' | 'sessions'>('activity');
  const [revokingSession, setRevokingSession] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [activityResponse, sessionResponse] = await Promise.all([
          Number.isFinite(Number(user.id)) ? adminActivityApi.getUserActivities(Number(user.id)) : Promise.resolve([] as UserActivityLog[]),
          sessionApi.getSessions(),
        ]);

        if (!mounted) return;

        setActivityLogs(activityResponse.map((entry) => ({
          id: String(entry.id),
          type: (entry.action as ActivityLog['type']) || 'login',
          timestamp: entry.created_at,
          ip: entry.ip_address,
          location: entry.location,
          device: entry.user_agent,
          browser: entry.user_agent,
          status: entry.action.toLowerCase().includes('failed') ? 'failed' : 'success',
          details: entry.description,
        })));

        setSessions(sessionResponse.map((session) => ({
          id: String(session.id),
          device: session.device_name,
          browser: session.browser,
          os: session.operating_system,
          ip: session.ip_address,
          location: session.location,
          lastActive: session.last_active,
          current: session.is_current,
        })));
      } catch {
        if (mounted) {
          setActivityLogs([]);
          setSessions([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [user.id]);

  const handleRevokeSession = async (sessionId: string) => {
    if (window.confirm('Are you sure you want to revoke this session? You will be logged out from that device.')) {
      setRevokingSession(sessionId);
      await new Promise(resolve => setTimeout(resolve, 500));
      setRevokingSession(null);
      // In real app, call API to revoke session
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold">Activity Log</h2>
        <p className="mt-2 text-muted-foreground">
          Review your account activity and manage active sessions.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 p-0 rounded-none bg-transparent border-0 md:p-1 md:rounded-lg md:bg-muted/20 md:border md:border-white/5">
        <button
          onClick={() => setActiveTab('activity')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'activity' 
              ? 'bg-primary text-white' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Activity History
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'sessions' 
              ? 'bg-primary text-white' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Active Sessions
        </button>
      </div>

      {/* Activity Tab */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          {loading ? (
            <div className="h-24 rounded-xl bg-muted/20 animate-pulse" />
          ) : activityLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity records available.</p>
          ) : (
            activityLogs.map(log => (
              <div key={log.id} className="p-0 rounded-none bg-transparent border-0 md:p-4 md:rounded-xl md:bg-muted/20 md:border md:border-white/5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                    {getTypeIcon(log.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-medium">{getTypeLabel(log.type)}</h4>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}>
                          {getStatusIcon(log.status)}
                          <span className="ml-1">{getStatusLabel(log.status)}</span>
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground sm:whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{log.details}</p>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {log.location}</span>
                      <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {log.ip}</span>
                      <span className="flex items-center gap-1">{getDeviceIcon(log.device)} {log.device}</span>
                      <span className="flex items-center gap-1"><Monitor className="w-3 h-3" /> {log.browser}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          {loading ? (
            <div className="h-24 rounded-xl bg-muted/20 animate-pulse" />
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active sessions available.</p>
          ) : (
            sessions.map(session => (
              <div key={session.id} className="p-0 rounded-none bg-transparent border-0 md:p-4 md:rounded-xl md:bg-muted/20 md:border md:border-white/5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary">
                      {getDeviceIcon(session.device)}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-medium">{session.device}</h4>
                        {session.current && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            Current Device
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{session.browser} on {session.os}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {session.location}</span>
                    <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {session.ip}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {session.lastActive}</span>
                    {!session.current && (
                      <button
                        onClick={() => handleRevokeSession(session.id)}
                        disabled={revokingSession === session.id}
                        className="px-3 py-1.5 text-sm font-medium text-red-500 border border-red-500 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      >
                        {revokingSession === session.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4 inline mr-1" /> Revoke
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Security Notice */}
      <div className="p-0 rounded-none bg-transparent border-0 md:p-4 md:rounded-xl md:bg-muted/20 md:border md:border-white/5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium">Security Notice</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              If you see any suspicious activity or unrecognized devices, immediately revoke the session and change your password. 
              Enable two-factor authentication for additional security.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

