import { useRef, useMemo, useState, useEffect, useCallback, createContext } from 'react';
import * as signalR from '@microsoft/signalr';

import { HOST_API } from 'src/config-global';

import type { ISyncJobStatus, ISyncJobResponse } from 'src/types/sync-job';

import axios, { endpoints } from 'src/utils/axios';

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
  notifications: SyncNotification[];
  totalUnRead: number;
  startSync: (type?: 'all' | 'invoices' | 'purchase-orders') => Promise<string | null>;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
};

export const SyncNotificationContext = createContext<SyncNotificationContextType>({
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
  const [notifications, setNotifications] = useState<SyncNotification[]>([]);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const subscribedJobs = useRef<Set<string>>(new Set());

  // Connect SignalR – wait until the auth token is available
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('accessToken')) {
      setAuthReady(true);
      return undefined;
    }
    // Poll briefly for the token (auth may still be initialising)
    const id = setInterval(() => {
      if (sessionStorage.getItem('accessToken')) {
        setAuthReady(true);
        clearInterval(id);
      }
    }, 500);
    return () => clearInterval(id);
  }, []);

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
        connectionRef.current = connection;
      })
      .catch((err) => console.error('SignalR connect failed:', err));

    return () => {
      connection.stop();
    };
  }, [authReady]);

  const subscribeToJob = useCallback((jobId: string) => {
    const conn = connectionRef.current;
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

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isUnRead: false })));
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const totalUnRead = useMemo(
    () => notifications.filter((n) => n.isUnRead).length,
    [notifications]
  );

  const value = useMemo(
    () => ({
      notifications,
      totalUnRead,
      startSync,
      markAllAsRead,
      removeNotification,
    }),
    [notifications, totalUnRead, startSync, markAllAsRead, removeNotification]
  );

  return (
    <SyncNotificationContext.Provider value={value}>{children}</SyncNotificationContext.Provider>
  );
}
