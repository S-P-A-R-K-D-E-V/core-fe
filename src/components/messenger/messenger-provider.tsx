'use client';

import { useRef, useEffect, useCallback, createContext, useContext, useMemo } from 'react';
import * as signalR from '@microsoft/signalr';

import { HOST_API } from 'src/config-global';

import { useAuthContext } from 'src/auth/hooks';
import {
  fetchConversations,
  fetchMessages,
  fetchUsers,
  markRead,
} from 'src/api/messenger';
import { useMessengerStore } from 'src/store/messenger-store';

import QuickChatLayer from './quick-chat-layer';

// ----------------------------------------------------------------------

type MessengerContextValue = {
  connection: signalR.HubConnection | null;
  openConversation: (convId: string) => Promise<void>;
  sendTyping: (convId: string) => void;
};

const MessengerCtx = createContext<MessengerContextValue>({
  connection: null,
  openConversation: async () => {},
  sendTyping: () => {},
});

export function useMessengerCtx() {
  return useContext(MessengerCtx);
}

// ----------------------------------------------------------------------

type Props = { children: React.ReactNode };

export default function MessengerProvider({ children }: Props) {
  const { user } = useAuthContext();
  const currentUserId: string | null = user?.id ?? null;

  const connRef = useRef<signalR.HubConnection | null>(null);
  const joinedRef = useRef<Set<string>>(new Set());
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const typingSent = useRef<Record<string, number>>({});
  const currentUserIdRef = useRef(currentUserId);

  // Keep ref in sync without triggering re-renders
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  // ── Bootstrap: load users + conversations ──────────────────────────────
  useEffect(() => {
    if (!currentUserId) return;
    const { setUserCache, setConversations } = useMessengerStore.getState();
    fetchUsers().then(setUserCache).catch(() => {});
    fetchConversations().then(setConversations).catch(() => {});
  }, [currentUserId]);

  // ── SignalR connection ─────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUserId || !HOST_API) return undefined;
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;
    if (!token) return undefined;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${HOST_API}/hubs/messenger`, {
        accessTokenFactory: () => sessionStorage.getItem('accessToken') ?? '',
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    // ── Event handlers ─────────────────────────────────────────────────
    conn.on('message', (ev: { id: string; conversationId: string; senderId: string; content: string; createdAt: string }) => {
      const s = useMessengerStore.getState();
      s.addMessage(ev as any);
      s.setTyping(ev.conversationId, ev.senderId, false);

      const uid = currentUserIdRef.current;
      if (ev.senderId === uid) return; // own message, skip notifications

      const sender = s.userCache[ev.senderId];
      const senderName = sender?.fullName ?? 'Tin nhắn mới';
      const preview = ev.content.slice(0, 80);

      // In-app toast when quick-chat window is NOT open
      if (!s.openQuickChats.includes(ev.conversationId)) {
        s.pushNotif({ convId: ev.conversationId, senderName, preview });
      }

      // Desktop notification when user is on another tab (document.hidden)
      if (
        typeof window !== 'undefined' &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted' &&
        document.hidden
      ) {
        try {
          const n = new Notification(senderName, {
            body: preview,
            icon: '/favicon/favicon-32x32.png',
            tag: ev.conversationId, // one notif per conversation (deduplicates)
          });
          n.onclick = () => {
            window.focus();
            useMessengerStore.getState().openQuickChat(ev.conversationId);
            n.close();
          };
        } catch {
          // Notification API may be unavailable in some browser configurations
        }
      }
    });

    conn.on('conversationTouched', (ev: any) => {
      const uid = currentUserIdRef.current;
      useMessengerStore.getState().touchConversation({
        ...ev,
        incrementsUnreadForSelf: ev.incrementsUnreadForSelf && ev.lastMessageSenderId !== uid,
      });
    });

    conn.on('conversationUpdated', () => {
      const { setConversations } = useMessengerStore.getState();
      fetchConversations().then(setConversations).catch(() => {});
    });

    conn.on('userTyping', (ev: { conversationId: string; userId: string }) => {
      const { setTyping } = useMessengerStore.getState();
      setTyping(ev.conversationId, ev.userId, true);
      const key = `${ev.conversationId}:${ev.userId}`;
      clearTimeout(typingTimers.current[key]);
      typingTimers.current[key] = setTimeout(() => {
        useMessengerStore.getState().setTyping(ev.conversationId, ev.userId, false);
      }, 3000);
    });

    conn.on('readReceipt', (ev: { conversationId: string; userId: string; readAt: string }) => {
      useMessengerStore.getState().applyReadReceipt(ev.conversationId, ev.userId, ev.readAt);
    });

    conn.on('userOnline', (userId: string) => useMessengerStore.getState().setOnline(userId, true));
    conn.on('userOffline', (userId: string) => useMessengerStore.getState().setOnline(userId, false));

    conn.onreconnected(async () => {
      for (const convId of Array.from(joinedRef.current)) {
        try { await conn.invoke('JoinConversation', convId); } catch { /* ignore */ }
      }
      const { setConversations } = useMessengerStore.getState();
      fetchConversations().then(setConversations).catch(() => {});
    });

    conn.start()
      .then(() => { connRef.current = conn; })
      .catch((err) => console.error('[MessengerProvider] connect failed', err));

    return () => {
      conn.stop().catch(() => {});
      connRef.current = null;
      joinedRef.current.clear();
      Object.values(typingTimers.current).forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  // ── Open conversation: join hub group + load messages ──────────────────
  const openConversation = useCallback(async (convId: string) => {
    const state = useMessengerStore.getState();
    if (!state.messagesByConv[convId]) {
      const msgs = await fetchMessages(convId, { limit: 50 });
      useMessengerStore.getState().setMessages(convId, msgs);
    }
    const conn = connRef.current;
    if (conn?.state === signalR.HubConnectionState.Connected && !joinedRef.current.has(convId)) {
      await conn.invoke('JoinConversation', convId);
      joinedRef.current.add(convId);
    }
    await markRead(convId);
    useMessengerStore.getState().clearUnread(convId);
    if (conn?.state === signalR.HubConnectionState.Connected) {
      conn.invoke('ReadReceiptAsync', convId).catch(() => {});
    }
  }, []);

  // ── Typing debounce ────────────────────────────────────────────────────
  const sendTyping = useCallback((convId: string) => {
    const conn = connRef.current;
    if (conn?.state !== signalR.HubConnectionState.Connected) return;
    const now = Date.now();
    if (!typingSent.current[convId] || now - typingSent.current[convId] > 2000) {
      typingSent.current[convId] = now;
      conn.invoke('TypingAsync', convId).catch(() => {});
    }
  }, []);

  const value = useMemo(() => ({
    connection: connRef.current,
    openConversation,
    sendTyping,
  }), [openConversation, sendTyping]);

  return (
    <MessengerCtx.Provider value={value}>
      {children}
      <QuickChatLayer currentUserId={currentUserId} />
    </MessengerCtx.Provider>
  );
}
