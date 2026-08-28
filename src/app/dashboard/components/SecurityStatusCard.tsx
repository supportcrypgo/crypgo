'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle2, ArrowRight, AlertCircle } from 'lucide-react';
import { securityApi, type SecurityHealthResponse } from '@/data/api';

const statusLabel = (health?: SecurityHealthResponse) => {
  if (!health) return 'Unknown';
  switch (health.risk_level) {
    case 'LOW':
      return 'Secure';
    case 'MEDIUM':
      return 'Attention Needed';
    case 'HIGH':
      return 'At Risk';
  }
};

const normalizeRecommendations = (recommendations?: SecurityHealthResponse['recommendations']) => {
  if (!Array.isArray(recommendations)) return [];

  return recommendations.map((item, index) => {
    if (typeof item === 'string') {
      return {
        id: `recommendation-${index}`,
        title: item,
        description: '',
        completed: false,
      };
    }

    return {
      id: item?.id ?? `recommendation-${index}`,
      title: item?.title ?? 'Security recommendation',
      description: item?.description ?? '',
      completed: Boolean(item?.completed),
    };
  });
};

export default function SecurityStatusCard() {
  const [health, setHealth] = useState<SecurityHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await securityApi.getHealth();
        if (mounted) setHealth(data);
      } catch {
        if (mounted) setHealth(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const items = health
    ? [
        { label: 'Two-factor authentication', value: health.two_fa_enabled ? 'Enabled' : 'Disabled' },
        { label: 'Active sessions', value: String(health.active_sessions) },
        { label: 'Trusted devices', value: String(health.trusted_devices) },
        { label: 'Recent logins', value: String(health.recent_logins) },
      ]
    : [];

  const recommendations = normalizeRecommendations(health?.recommendations);

  return (
    <div className="bg-deepSlate/50 border border-white/5 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h3 className="text-base font-semibold text-white">Security Status</h3>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-14 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-14 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-14 rounded-lg bg-white/5 animate-pulse" />
        </div>
      ) : !health ? (
        <div className="flex items-center gap-2 text-sm text-charcoalGray">
          <AlertCircle className="w-4 h-4" />
          No security health data available.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
            <div>
              <p className="text-xs text-charcoalGray">Overall Status</p>
              <p className="text-sm font-semibold text-white">{statusLabel(health)}</p>
            </div>
            <span className={`text-xs font-medium ${health.risk_level === 'LOW' ? 'text-green-400' : health.risk_level === 'MEDIUM' ? 'text-yellow-400' : 'text-red-400'}`}>
              {health.risk_level}
            </span>
          </div>
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                </div>
                <p className="text-sm font-medium text-white">{item.label}</p>
              </div>
              <span className="text-xs font-medium text-green-400 flex items-center gap-1">
                {item.value}
              </span>
            </div>
          ))}
          {!!recommendations.length && (
            <div className="rounded-lg border border-white/5 bg-white/5 p-3">
              <p className="text-xs text-charcoalGray mb-2">Recommendations</p>
              <ul className="space-y-1 text-xs text-white">
                {recommendations.slice(0, 3).map((rec) => (
                  <li key={rec.id} className="flex items-start gap-2">
                    <span
                      className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${
                        rec.completed ? 'bg-green-400' : 'bg-primary'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-white">{rec.title}</p>
                      <p className="text-[11px] leading-relaxed text-charcoalGray">{rec.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button className="w-full mt-4 h-10 rounded-lg bg-white/5 border border-white/5 text-xs font-medium text-charcoalGray hover:text-white hover:bg-white/10 hover:border-white/10 transition-all flex items-center justify-center gap-1.5">
            Manage Security
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
