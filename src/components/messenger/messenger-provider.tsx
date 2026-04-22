'use client';

import { useRef, useEffect, createContext, useContext, useMemo } from 'react';
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

  const store = useMessengerStore();

  // ── Bootstrap: load users + conversations ──────────────────────────────
  useEffect(() => {
    if (!currentUserId) return;
    fetchUsers()
      .then((users) => store.setUserCache(users))
      .catch(() => {});
    fetchConversations()
      .then((list) => store.setConversations(list))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  // ── SignalR connection ─────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUserId || !HOST_API) return undefined;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${HOST_API}/hubs/messenger`, {
        accessTokenFactory: () =>
          (typeof window !== 'undefined' && sessionStorage.getItem('accessToken')) || '',
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    // ── Event handlers ─────────────────────────────────────────────────
    conn.on('message', (ev: { id: string; conversationId: string; senderId: string; content: string; createdAt: string }) => {
      store.addMessage(ev as any);
      // Clear typing for this sender
      store.setTyping(ev.conversationId, ev.senderId, false);

      // Notify if the quick-chat window is NOT open
      const state = useMessengerStore.getState();
      if (!state.openQuickChats.includes(ev.conversationId) && ev.senderId !== currentUserId) {
        const sender = state.userCache[ev.senderId];
        store.pushNotif({
          convId: ev.conversationId,
          senderName: sender?.fullName ?? 'Tin nhắn mới',
          preview: ev.content.slice(0, 80),
        });
      }
    });

    conn.on('conversationTouched', (ev: any) => {
      store.touchConversation({ ...ev, incrementsUnreadForSelf: ev.incrementsUnreadForSelf && ev.lastMessageSenderId !== currentUserId });
    });

    conn.on('conversationUpdated', () => {
      fetchConversations().then((list) => store.setConversations(list)).catch(() => {});
    });

    conn.on('userTyping', (ev: { conversationId: string; userId: string }) => {
      store.setTyping(ev.conversationId, ev.userId, true);
      // Auto-expire typing after 3 s
      clearTimeout(typingTimers.current[`${ev.conversationId}:${ev.userId}`]);
      typingTimers.current[`${ev.conversationId}:${ev.userId}`] = setTimeout(() => {
        store.setTyping(ev.conversationId, ev.userId, false);
      }, 3000);
    });

    conn.on('readReceipt', (ev: { conversationId: string; userId: string; readAt: string }) => {
      store.applyReadReceipt(ev.conversationId, ev.userId, ev.readAt);
    });

    conn.on('userOnline', (userId: string) => store.setOnline(userId, true));
    conn.on('userOffline', (userId: string) => store.setOnline(userId, false));

    conn.onreconnected(async () => {
      for (const convId of Array.from(joinedRef.current)) {
        try { await conn.invoke('JoinConversation', convId); } catch { /* ignore */ }
      }
      fetchConversations().then((list) => store.setConversations(list)).catch(() => {});
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
  const openConversation = async (convId: string) => {
    const state = useMessengerStore.getState();
    if (!state.messagesByConv[convId]) {
      const msgs = await fetchMessages(convId, { limit: 50 });
      store.setMessages(convId, msgs);
    }
    const conn = connRef.current;
    if (conn?.state === signalR.HubConnectionState.Connected && !joinedRef.current.has(convId)) {
      await conn.invoke('JoinConversation', convId);
      joinedRef.current.add(convId);
    }
    await markRead(convId);
    store.clearUnread(convId);
    if (conn?.state === signalR.HubConnectionState.Connected) {
      conn.invoke('ReadReceiptAsync', convId).catch(() => {});
    }
  };

  // ── Typing debounce ────────────────────────────────────────────────────
  const typingSent = useRef<Record<string, number>>({});
  const sendTyping = (convId: string) => {
    const conn = connRef.current;
    if (conn?.state !== signalR.HubConnectionState.Connected) return;
    const now = Date.now();
    if (!typingSent.current[convId] || now - typingSent.current[convId] > 2000) {
      typingSent.current[convId] = now;
      conn.invoke('TypingAsync', convId).catch(() => {});
    }
  };

  const value = useMemo(() => ({
    connection: connRef.current,
    openConversation,
    sendTyping,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  return (
    <MessengerCtx.Provider value={value}>
      {children}
      <QuickChatLayer currentUserId={currentUserId} />
    </MessengerCtx.Provider>
  );
}
