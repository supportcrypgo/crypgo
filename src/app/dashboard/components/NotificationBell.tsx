'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, Mail, Shield, AlertCircle, AlertTriangle } from 'lucide-react';

export default function NotificationBell() {
  const { unreadCount, fetchNotifications, markAsRead, markAllAsRead, isLoading, error, notifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [localNotifications, setLocalNotifications] = useState(notifications);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications({ unread_only: showUnreadOnly });
    }
  }, [isOpen, showUnreadOnly, fetchNotifications]);

  // Sync with hook notifications
  useEffect(() => {
    setLocalNotifications(notifications);
  }, [notifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (id: number) => {
    await markAsRead([id]);
    setLocalNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    setLocalNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'security':
        return <Shield className="w-5 h-5 text-amber-400" />;
      case 'price_alert':
        return <AlertTriangle className="w-5 h-5 text-orange-400" />;
      case 'system':
        return <AlertCircle className="w-5 h-5 text-blue-400" />;
      case 'wallet':
        return <Mail className="w-5 h-5 text-green-400" />;
      default:
        return <Bell className="w-5 h-5 text-charcoalGray" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-deepSlate/50 transition-colors"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5 text-charcoalGray" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-5 bg-primary rounded-full text-[10px] font-bold text-darkmode flex items-center justify-center px-1.5">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[380px] bg-deepSlate rounded-2xl border border-deepSlate/50 shadow-2xl overflow-hidden z-50 animate-in fade-in-20 zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-deepSlate/50">
            <h3 className="font-semibold text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showUnreadOnly}
                  onChange={e => setShowUnreadOnly(e.target.checked)}
                  className="w-4 h-4 rounded border-charcoalGray bg-deepSlate text-primary focus:ring-primary"
                />
                <span className="text-xs text-charcoalGray">Unread only</span>
              </label>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-primary hover:text-primary/80 font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {isLoading && localNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-charcoalGray">Loading...</p>
              </div>
            ) : error ? (
              <div className="px-4 py-4 text-center text-red-400 text-sm">{error}</div>
            ) : localNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-10 h-10 text-charcoalGray mx-auto mb-2" />
                <p className="text-sm text-charcoalGray">No notifications</p>
              </div>
            ) : (
              <ul className="divide-y divide-deepSlate/50">
                {localNotifications.map((notification) => (
                  <li
                    key={notification.id}
                    className={`px-4 py-3 flex gap-3 ${!notification.is_read ? 'bg-white/5' : ''} hover:bg-white/2.5 transition-colors`}
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mt-0.5">
                      {getNotificationIcon(notification.type || 'default')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium text-white ${!notification.is_read ? 'font-semibold' : ''} leading-tight`}>
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsRead(notification.id);
                            }}
                            className="flex-shrink-0 w-5 h-5 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
                            aria-label="Mark as read"
                          >
                            <Check className="w-3.5 h-3.5 text-green-400" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-charcoalGray mt-1 line-clamp-2">{notification.body}</p>
                      <p className="text-[10px] text-charcoalGray/60 mt-1">
                        {notification.created_at ? formatDistanceToNow(new Date(notification.created_at), { addSuffix: true }) : 'Just now'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          {localNotifications.length > 0 && (
            <div className="px-4 py-3 border-t border-deepSlate/50">
              <button
                onClick={() => setShowUnreadOnly(false)}
                className="w-full text-center text-xs text-primary hover:text-primary/80 font-medium"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}