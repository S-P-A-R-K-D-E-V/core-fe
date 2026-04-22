import { useState, useEffect, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';

import { HOST_API } from 'src/config-global';

import { type InternalUser, fetchUsers } from 'src/api/messenger';

// Singleton hub shared between UsersPopover and MessengerView so we only
// maintain one WebSocket connection for presence tracking.
let _sharedConn: signalR.HubConnection | null = null;
let _refCount = 0;
const _listeners = new Set<() => void>();

function getSharedConnection() {
  if (!_sharedConn && HOST_API) {
    _sharedConn = new signalR.HubConnectionBuilder()
      .withUrl(`${HOST_API}/hubs/messenger`, {
        accessTokenFactory: () =>
          (typeof window !== 'undefined' && sessionStorage.getItem('accessToken')) || '',
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();
  }
  return _sharedConn;
}

export function usePresence() {
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchUsers();
      setUsers(list);
    } catch (err) {
      console.error('[Presence] fetchUsers error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const conn = getSharedConnection();
    if (!conn) return undefined;

    const handleOnline = (userId: string) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, online: true } : u))
      );
    };
    const handleOffline = (userId: string) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, online: false } : u))
      );
    };

    conn.on('userOnline', handleOnline);
    conn.on('userOffline', handleOffline);

    _refCount++;
    if (conn.state === signalR.HubConnectionState.Disconnected) {
      conn.start().catch((err) => console.error('[Presence] hub start error', err));
    }

    return () => {
      conn.off('userOnline', handleOnline);
      conn.off('userOffline', handleOffline);
      _refCount--;
      if (_refCount <= 0) {
        conn.stop().catch(() => {});
        _sharedConn = null;
      }
    };
  }, []);

  const onlineCount = users.filter((u) => u.online).length;

  return { users, loading, onlineCount, reload: load };
}
