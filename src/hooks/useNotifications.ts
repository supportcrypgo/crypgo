'use client';

import { useState, useCallback, useEffect } from 'react';
import { notificationsApi } from '@/data/api';
import type { 
  Notification, 
  PushSubscription,
  SubscribePushData,
  NotificationMarkReadData
} from '@/data/api';

const UNREAD_COUNT_CACHE_TTL_MS = 15 * 60 * 1000;
let cachedUnreadCount: number | null = null;
let cachedUnreadCountAt = 0;
let unreadCountInFlight: Promise<number> | null = null;

export interface NotificationsHook {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  fetchNotifications: (params?: { unread_only?: boolean; page?: number; page_size?: number }) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (ids: number[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  getPushSubscriptions: () => Promise<PushSubscription[]>;
  subscribeToPush: (data: SubscribePushData) => Promise<PushSubscription>;
  unsubscribeFromPush: (id: number) => Promise<void>;
}

export function useNotifications(): NotificationsHook {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async (params?: { unread_only?: boolean; page?: number; page_size?: number }) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await notificationsApi.list(params);
      const items = response.results || [];
      setNotifications(items);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch notifications');
      console.error('fetchNotifications error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const now = Date.now();
      if (cachedUnreadCount !== null && now - cachedUnreadCountAt < UNREAD_COUNT_CACHE_TTL_MS) {
        setUnreadCount(cachedUnreadCount);
        return;
      }

      if (unreadCountInFlight) {
        const count = await unreadCountInFlight;
        setUnreadCount(count);
        return;
      }

      unreadCountInFlight = (async () => {
        const response = await notificationsApi.getUnreadCount();
        const count = response.unread_count || 0;
        cachedUnreadCount = count;
        cachedUnreadCountAt = Date.now();
        return count;
      })();

      const count = await unreadCountInFlight;
      setUnreadCount(count);
    } catch (err: any) {
      console.error('fetchUnreadCount error:', err);
    } finally {
      unreadCountInFlight = null;
    }
  }, []);

  const markAsRead = useCallback(async (ids: number[]) => {
    try {
      await notificationsApi.markRead({ notification_ids: ids, mark_all: false });
      setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - ids.length));
      cachedUnreadCount = Math.max(0, (cachedUnreadCount ?? 0) - ids.length);
      cachedUnreadCountAt = Date.now();
    } catch (err: any) {
      console.error('markAsRead error:', err);
      throw err;
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationsApi.markRead({ mark_all: true });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      cachedUnreadCount = 0;
      cachedUnreadCountAt = Date.now();
    } catch (err: any) {
      console.error('markAllAsRead error:', err);
      throw err;
    }
  }, []);

  const deleteNotification = useCallback(async (id: number) => {
    try {
      await notificationsApi.delete(id);
      const deleted = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (deleted && !deleted.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err: any) {
      console.error('deleteNotification error:', err);
      throw err;
    }
  }, [notifications]);

  const getPushSubscriptions = useCallback(async () => {
    return notificationsApi.getPushSubscription();
  }, []);

  const subscribeToPush = useCallback(async (data: SubscribePushData) => {
    return notificationsApi.subscribePush(data);
  }, []);

  const unsubscribeFromPush = useCallback(async (id: number) => {
    return notificationsApi.unsubscribePush(id);
  }, []);

  // Auto-fetch unread count on mount
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    getPushSubscriptions,
    subscribeToPush,
    unsubscribeFromPush,
  };
}
