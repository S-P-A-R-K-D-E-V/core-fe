import { useRef, useMemo, useState, useEffect, useCallback, createContext } from 'react';
import * as signalR from '@microsoft/signalr';

import { HOST_API } from 'src/config-global';

import type { ISyncJobStatus, ISyncJobResponse } from 'src/types/sync-job';
import type { INotification, NotificationCategory } from 'src/types/notification';

import { setSession } from 'src/auth/context/jwt/utils';

import axios, { endpoints } from 'src/utils/axios';
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  deleteNotification as apiDeleteNotification,
} from 'src/api/notifications';

// ----------------------------------------------------------------------

type SyncNotification = {
  id: string;
  jobId: string;
  title: string;
  message: string;
  status: ISyncJobStatus['status'];
  createdAt: Date;
  isUnRead: boolean;
};

type SyncNotificationContextType = {
  // Persistent notifications (from DB)
  dbNotifications: INotification[];
  dbTotalCount: number;
  dbUnreadCount: number;
  loadNotifications: (page?: number, category?: NotificationCategory) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markDbAllAsRead: () => Promise<void>;
  deleteDbNotification: (notificationId: string) => Promise<void>;
  // Sync notifications (ephemeral/real-time)
  notifications: SyncNotification[];
  totalUnRead: number;
  startSync: (type?: 'all' | 'invoices' | 'purchase-orders') => Promise<string | null>;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
};

export const SyncNotificationContext = createContext<SyncNotificationContextType>({
  dbNotifications: [],
  dbTotalCount: 0,
  dbUnreadCount: 0,
  loadNotifications: async () => {},
  markAsRead: async () => {},
  markDbAllAsRead: async () => {},
  deleteDbNotification: async () => {},
  notifications: [],
  totalUnRead: 0,
  startSync: async () => null,
  markAllAsRead: () => {},
  removeNotification: () => {},
});

// ----------------------------------------------------------------------

const SYNC_LABELS: Record<string, string> = {
  all: 'Đồng bộ toàn bộ KiotViet',
  invoices: 'Đồng bộ hóa đơn KiotViet',
  'purchase-orders': 'Đồng bộ đơn nhập hàng KiotViet',
};

function getSyncEndpoint(type: string): string {
  switch (type) {
    case 'invoices':
      return endpoints.kiotViet.syncInvoices;
    case 'purchase-orders':
      return endpoints.kiotViet.syncPurchaseOrders;
    default:
      return endpoints.kiotViet.sync;
  }
}

// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
};

export function SyncNotificationProvider({ children }: Props) {
  // Sync notifications state (ephemeral)
  const [notifications, setNotifications] = useState<SyncNotification[]>([]);
  const syncConnectionRef = useRef<signalR.HubConnection | null>(null);
  const subscribedJobs = useRef<Set<string>>(new Set());

  // DB notifications state (persistent)
  const [dbNotifications, setDbNotifications] = useState<INotification[]>([]);
  const [dbTotalCount, setDbTotalCount] = useState(0);
  const [dbUnreadCount, setDbUnreadCount] = useState(0);
  const notifConnectionRef = useRef<signalR.HubConnection | null>(null);

  // Connect SignalR – wait until the auth token is available
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('accessToken')) {
      setAuthReady(true);
      return undefined;
    }
    const id = setInterval(() => {
      if (sessionStorage.getItem('accessToken')) {
        setAuthReady(true);
        clearInterval(id);
      }
    }, 500);
    return () => clearInterval(id);
  }, []);

  // --- Load initial DB notifications ---
  const loadNotifications = useCallback(
    async (page: number = 1, category?: NotificationCategory) => {
      try {
        const data = await getNotifications({ page, pageSize: 20, category });
        if (page === 1) {
          setDbNotifications(data.items);
        } else {
          setDbNotifications((prev) => [...prev, ...data.items]);
        }
        setDbTotalCount(data.totalCount);
        setDbUnreadCount(data.unreadCount);
      } catch (error) {
        console.error('Failed to load notifications:', error);
      }
    },
    []
  );

  useEffect(() => {
    if (authReady) {
      loadNotifications();
    }
  }, [authReady, loadNotifications]);

  // --- Connect to Notification Hub (persistent notifications) ---
  useEffect(() => {
    if (!authReady || !HOST_API) return undefined;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${HOST_API}/hubs/notifications`, {
        accessTokenFactory: () => sessionStorage.getItem('accessToken') || '',
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('NewNotification', (notification: INotification) => {
      setDbNotifications((prev) => [notification, ...prev]);
      setDbUnreadCount((prev) => prev + 1);
      setDbTotalCount((prev) => prev + 1);
    });

    connection.on('ForceLogout', (payload: { Reason: string }) => {
      console.warn('Force logout:', payload.Reason);
      // Clear all session/cache to ensure fresh navigation on re-login
      setSession(null);
      sessionStorage.clear();
      localStorage.removeItem('sessionToken');
      // Full page reload clears SWR cache, React state, and SignalR connections
      window.location.href = '/auth/jwt/login';
    });

    connection
      .start()
      .then(() => {
        notifConnectionRef.current = connection;
      })
      .catch((err) => console.error('Notification SignalR connect failed:', err));

    return () => {
      connection.stop();
    };
  }, [authReady]);

  // --- Connect to Sync Hub (ephemeral sync notifications) ---
  useEffect(() => {
    if (!authReady || !HOST_API) return undefined;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${HOST_API}/hubs/sync`, {
        accessTokenFactory: () => sessionStorage.getItem('accessToken') || '',
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('SyncUpdate', (status: ISyncJobStatus) => {
      setNotifications((prev) =>
        prev.map((n) => {
          if (n.jobId !== status.jobId) return n;

          const completedSteps = status.steps?.length ?? 0;
          let message = '';

          if (status.status === 'Running') {
            const lastStep = status.steps?.[completedSteps - 1];
            message = lastStep
              ? `Đang xử lý: ${lastStep.step} (${completedSteps} bước hoàn thành)`
              : 'Đang khởi tạo...';
          } else if (status.status === 'Completed') {
            message = `Hoàn thành ${completedSteps} bước đồng bộ`;
          } else if (status.status === 'Failed') {
            message = status.error || 'Đồng bộ thất bại';
          }

          return {
            ...n,
            status: status.status,
            message,
            isUnRead: true,
          };
        })
      );
    });

    connection
      .start()
      .then(() => {
        syncConnectionRef.current = connection;
      })
      .catch((err) => console.error('Sync SignalR connect failed:', err));

    return () => {
      connection.stop();
    };
  }, [authReady]);

  const subscribeToJob = useCallback((jobId: string) => {
    const conn = syncConnectionRef.current;
    if (conn && conn.state === signalR.HubConnectionState.Connected && !subscribedJobs.current.has(jobId)) {
      conn.invoke('SubscribeToJob', jobId).catch(console.error);
      subscribedJobs.current.add(jobId);
    }
  }, []);

  const startSync = useCallback(
    async (type: 'all' | 'invoices' | 'purchase-orders' = 'all'): Promise<string | null> => {
      try {
        const endpoint = getSyncEndpoint(type);
        const { data } = await axios.post<ISyncJobResponse>(endpoint);
        const { jobId } = data;

        const notification: SyncNotification = {
          id: jobId,
          jobId,
          title: SYNC_LABELS[type] || 'Đồng bộ KiotViet',
          message: 'Đang chờ xử lý...',
          status: 'Pending',
          createdAt: new Date(),
          isUnRead: true,
        };

        setNotifications((prev) => [notification, ...prev]);
        subscribeToJob(jobId);

        return jobId;
      } catch (error) {
        console.error('Start sync failed:', error);
        return null;
      }
    },
    [subscribeToJob]
  );

  // --- Sync notification actions ---
  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isUnRead: false })));
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // --- DB notification actions ---
  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        await markNotificationAsRead(notificationId);
        setDbNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
          )
        );
        setDbUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Mark as read failed:', error);
      }
    },
    []
  );

  const markDbAllAsRead = useCallback(async () => {
    try {
      await markAllNotificationsAsRead();
      setDbNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setDbUnreadCount(0);
    } catch (error) {
      console.error('Mark all as read failed:', error);
    }
  }, []);

  const deleteDbNotification = useCallback(async (notificationId: string) => {
    try {
      await apiDeleteNotification(notificationId);
      setDbNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setDbTotalCount((prev) => prev - 1);
    } catch (error) {
      console.error('Delete notification failed:', error);
    }
  }, []);

  const totalUnRead = useMemo(
    () => notifications.filter((n) => n.isUnRead).length + dbUnreadCount,
    [notifications, dbUnreadCount]
  );

  const value = useMemo(
    () => ({
      dbNotifications,
      dbTotalCount,
      dbUnreadCount,
      loadNotifications,
      markAsRead,
      markDbAllAsRead,
      deleteDbNotification,
      notifications,
      totalUnRead,
      startSync,
      markAllAsRead,
      removeNotification,
    }),
    [
      dbNotifications,
      dbTotalCount,
      dbUnreadCount,
      loadNotifications,
      markAsRead,
      markDbAllAsRead,
      deleteDbNotification,
      notifications,
      totalUnRead,
      startSync,
      markAllAsRead,
      removeNotification,
    ]
  );

  return (
    <SyncNotificationContext.Provider value={value}>{children}</SyncNotificationContext.Provider>
  );
}
