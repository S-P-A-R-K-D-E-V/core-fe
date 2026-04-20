import { useRef, useState, useEffect, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';

import { HOST_API } from 'src/config-global';

import {
  type ChatbotSession,
  type ChatbotMessage,
  getChatbotMessages,
  sendChatbotMessage,
  startChatbotSession,
} from 'src/api/chatbot';

// ----------------------------------------------------------------------

const STORAGE_KEY = 'chatbot.sessionId';

type ChunkEvent = { sessionId: string; messageId: string; content: string };
type CompletedEvent = { sessionId: string; messageId: string; content: string; fromCache: boolean };
type ErrorEvent = { sessionId: string; messageId: string; error: string };

export type ChatbotPanelState = {
  ready: boolean;
  session: ChatbotSession | null;
  messages: ChatbotMessage[];
  typing: boolean;
  error: string | null;
  sendMessage: (content: string, phone?: string | null) => Promise<void>;
  resetSession: () => Promise<void>;
};

export function useChatbot(opts?: { phone?: string | null; displayName?: string | null }): ChatbotPanelState {
  const [session, setSession] = useState<ChatbotSession | null>(null);
  const [messages, setMessages] = useState<ChatbotMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const connRef = useRef<signalR.HubConnection | null>(null);
  const joinedSessionRef = useRef<string | null>(null);

  // 1. Bootstrap session
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const storedId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        const s = await startChatbotSession({
          sessionId: storedId,
          phone: opts?.phone ?? null,
          displayName: opts?.displayName ?? null,
        });
        if (cancelled) return;
        setSession(s);
        if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, s.sessionId);

        const history = await getChatbotMessages(s.sessionId, 50);
        if (!cancelled) setMessages(history);
        if (!cancelled) setReady(true);
      } catch (err) {
        console.error('Chatbot init failed', err);
        if (!cancelled) setError('Không kết nối được chatbot');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts?.phone, opts?.displayName]);

  // 2. Connect SignalR + join group
  useEffect(() => {
    if (!session?.sessionId || !HOST_API) return undefined;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${HOST_API}/hubs/chat`, {
        accessTokenFactory: () =>
          (typeof window !== 'undefined' && sessionStorage.getItem('accessToken')) || '',
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('chunk', (ev: ChunkEvent) => {
      if (ev.sessionId !== session.sessionId) return;
      setTyping(true);
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === ev.messageId);
        if (idx >= 0) {
          const next = prev.slice();
          next[idx] = { ...next[idx], content: next[idx].content + ev.content };
          return next;
        }
        return [
          ...prev,
          {
            id: ev.messageId,
            role: 'assistant',
            content: ev.content,
            createdAt: new Date().toISOString(),
          },
        ];
      });
    });

    connection.on('completed', (ev: CompletedEvent) => {
      if (ev.sessionId !== session.sessionId) return;
      setTyping(false);
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === ev.messageId);
        if (idx >= 0) {
          const next = prev.slice();
          next[idx] = { ...next[idx], content: ev.content, fromCache: ev.fromCache };
          return next;
        }
        return [
          ...prev,
          {
            id: ev.messageId,
            role: 'assistant',
            content: ev.content,
            createdAt: new Date().toISOString(),
            fromCache: ev.fromCache,
          },
        ];
      });
    });

    connection.on('error', (ev: ErrorEvent) => {
      if (ev.sessionId !== session.sessionId) return;
      setTyping(false);
      setError(ev.error);
    });

    connection
      .start()
      .then(() => {
        connRef.current = connection;
        joinedSessionRef.current = session.sessionId;
        return connection.invoke('JoinSession', session.sessionId);
      })
      .catch((err) => {
        console.error('Chatbot SignalR connect failed', err);
      });

    return () => {
      connection.stop().catch(() => {});
      connRef.current = null;
      joinedSessionRef.current = null;
    };
  }, [session?.sessionId]);

  const sendMessage = useCallback(
    async (content: string, phone?: string | null) => {
      if (!session?.sessionId || !content.trim()) return;
      const optimistic: ChatbotMessage = {
        id: `local-${Date.now()}`,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setTyping(true);
      setError(null);
      try {
        const res = await sendChatbotMessage({
          sessionId: session.sessionId,
          content,
          phone: phone ?? opts?.phone ?? null,
        });
        if (res.fromCache && res.cachedAnswer) {
          setTyping(false);
          setMessages((prev) => [
            ...prev,
            {
              id: res.assistantMessageId,
              role: 'assistant',
              content: res.cachedAnswer ?? '',
              createdAt: new Date().toISOString(),
              fromCache: true,
            },
          ]);
        }
      } catch (err) {
        console.error('Chatbot sendMessage failed', err);
        setTyping(false);
        setError('Không gửi được tin nhắn');
      }
    },
    [session?.sessionId, opts?.phone]
  );

  const resetSession = useCallback(async () => {
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setMessages([]);
    setReady(false);
    const s = await startChatbotSession({ sessionId: null, phone: opts?.phone ?? null });
    setSession(s);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, s.sessionId);
    setReady(true);
  }, [opts?.phone]);

  return { ready, session, messages, typing, error, sendMessage, resetSession };
}
