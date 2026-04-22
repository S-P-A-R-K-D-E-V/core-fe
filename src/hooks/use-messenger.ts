import { useRef, useState, useEffect, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';

import { HOST_API } from 'src/config-global';

import {
  type DirectMessage,
  type ConversationSummary,
  markRead as apiMarkRead,
  fetchMessages as apiFetchMessages,
  sendMessage as apiSendMessage,
  fetchConversations as apiFetchConversations,
} from 'src/api/messenger';

// ----------------------------------------------------------------------

type MessageEvent = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
};
type ConversationTouchedEvent = {
  conversationId: string;
  lastMessagePreview: string | null;
  lastMessageSenderId: string | null;
  lastMessageAt: string | null;
  incrementsUnreadForSelf: boolean;
};

export function useMessenger(currentUserId: string | null) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messagesByConv, setMessagesByConv] = useState<Record<string, DirectMessage[]>>({});
  const [loading, setLoading] = useState(false);

  const connRef = useRef<signalR.HubConnection | null>(null);
  const joinedRef = useRef<Set<string>>(new Set());

  // 1. Load conversation list
  const reloadConversations = useCallback(async () => {
    const list = await apiFetchConversations();
    setConversations(list);
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    reloadConversations().catch((err) => console.error('[Messenger] loadConversations', err));
  }, [currentUserId, reloadConversations]);

  // 2. SignalR connect (once per user)
  useEffect(() => {
    if (!currentUserId || !HOST_API) return undefined;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${HOST_API}/hubs/messenger`, {
        accessTokenFactory: () =>
          (typeof window !== 'undefined' && sessionStorage.getItem('accessToken')) || '',
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('message', (ev: MessageEvent) => {
      setMessagesByConv((prev) => {
        const list = prev[ev.conversationId] ?? [];
        if (list.some((m) => m.id === ev.id)) return prev; // de-dupe echo
        return { ...prev, [ev.conversationId]: [...list, ev as DirectMessage] };
      });
    });

    connection.on('conversationTouched', (ev: ConversationTouchedEvent) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === ev.conversationId);
        if (idx < 0) {
          // New conversation — reload list
          reloadConversations().catch(() => {});
          return prev;
        }
        const next = prev.slice();
        next[idx] = {
          ...next[idx],
          lastMessagePreview: ev.lastMessagePreview,
          lastMessageSenderId: ev.lastMessageSenderId,
          lastMessageAt: ev.lastMessageAt,
          unreadCount: ev.incrementsUnreadForSelf ? next[idx].unreadCount + 1 : next[idx].unreadCount,
        };
        // Move touched conversation to top
        next.sort((a, b) =>
          (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '')
        );
        return next;
      });
    });

    connection.on('conversationUpdated', () => {
      reloadConversations().catch(() => {});
    });

    connection.onreconnected(async () => {
      for (const convId of Array.from(joinedRef.current)) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await connection.invoke('JoinConversation', convId);
        } catch (err) {
          console.error('[Messenger] rejoin failed', convId, err);
        }
      }
    });

    connection
      .start()
      .then(() => {
        connRef.current = connection;
        console.info('[Messenger] SignalR connected');
      })
      .catch((err) => console.error('[Messenger] SignalR connect failed', err));

    return () => {
      connection.stop().catch(() => {});
      connRef.current = null;
      joinedRef.current.clear();
    };
  }, [currentUserId, reloadConversations]);

  // 3. Open a conversation — join hub group + load history
  const openConversation = useCallback(async (conversationId: string) => {
    setActiveId(conversationId);
    setLoading(true);
    try {
      if (!messagesByConv[conversationId]) {
        const history = await apiFetchMessages(conversationId, { limit: 50 });
        setMessagesByConv((prev) => ({ ...prev, [conversationId]: history }));
      }
      const conn = connRef.current;
      if (conn && conn.state === signalR.HubConnectionState.Connected &&
          !joinedRef.current.has(conversationId)) {
        await conn.invoke('JoinConversation', conversationId);
        joinedRef.current.add(conversationId);
      }
      await apiMarkRead(conversationId);
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
      );
    } finally {
      setLoading(false);
    }
  }, [messagesByConv]);

  // 4. Send message — optimistic + server echo via SignalR
  const send = useCallback(async (content: string) => {
    if (!activeId || !content.trim()) return;
    const trimmed = content.trim();
    try {
      const saved = await apiSendMessage(activeId, trimmed);
      setMessagesByConv((prev) => {
        const list = prev[activeId] ?? [];
        if (list.some((m) => m.id === saved.id)) return prev;
        return { ...prev, [activeId]: [...list, saved] };
      });
    } catch (err) {
      console.error('[Messenger] send failed', err);
      throw err;
    }
  }, [activeId]);

  return {
    conversations,
    activeId,
    messages: activeId ? messagesByConv[activeId] ?? [] : [],
    loading,
    openConversation,
    send,
    reloadConversations,
  };
}
