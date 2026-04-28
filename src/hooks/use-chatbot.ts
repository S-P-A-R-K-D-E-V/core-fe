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

type StreamingStartedEvent = { sessionId: string; messageId: string };
type ChunkEvent = { sessionId: string; messageId: string; content: string };
type CompletedEvent = { sessionId: string; messageId: string; content: string; fromCache: boolean };
type ErrorEvent = { sessionId: string; messageId: string; error: string };

export type ChatbotPanelState = {
  ready: boolean;
  session: ChatbotSession | null;
  messages: ChatbotMessage[];
  typing: boolean;
  streamingMessageId: string | null;
  error: string | null;
  sendMessage: (content: string, phone?: string | null) => Promise<void>;
  resetSession: () => Promise<void>;
};

export function useChatbot(opts?: { phone?: string | null; displayName?: string | null }): ChatbotPanelState {
  const [session, setSession] = useState<ChatbotSession | null>(null);
  const [messages, setMessages] = useState<ChatbotMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
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
        // Filter out orphaned empty assistant placeholders from interrupted streams.
        // Without this they render as a stuck "…" bubble when the page reloads.
        const cleaned = history.filter(
          (m) => !(m.role === 'assistant' && (!m.content || m.content.trim() === ''))
        );
        if (!cancelled) setMessages(cleaned);
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

    connection.on('streamingStarted', (ev: StreamingStartedEvent) => {
      console.info('[Chatbot] streamingStarted', ev);
      if (ev.sessionId !== session.sessionId) return;
      setTyping(true);
      setStreamingMessageId(ev.messageId);
      // Ensure a placeholder exists for this messageId so the very first chunk
      // can append to it. Idempotent — won't duplicate if sendMessage already
      // added the optimistic placeholder.
      setMessages((prev) => {
        if (prev.some((m) => m.id === ev.messageId)) return prev;
        return [
          ...prev,
          {
            id: ev.messageId,
            role: 'assistant',
            content: '',
            createdAt: new Date().toISOString(),
          },
        ];
      });
    });

    connection.on('chunk', (ev: ChunkEvent) => {
      console.debug('[Chatbot] chunk', { msgId: ev.messageId, len: ev.content.length });
      if (ev.sessionId !== session.sessionId) return;
      setTyping(true);
      setStreamingMessageId(ev.messageId);
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
      console.info('[Chatbot] completed', { msgId: ev.messageId, len: ev.content.length, fromCache: ev.fromCache });
      if (ev.sessionId !== session.sessionId) return;
      setTyping(false);
      setStreamingMessageId(null);
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
      console.warn('[Chatbot] error event', ev);
      if (ev.sessionId !== session.sessionId) return;
      setTyping(false);
      setStreamingMessageId(null);
      setError(ev.error);
    });

    // Re-join the session group whenever SignalR reconnects.
    // withAutomaticReconnect() reconnects the transport but does NOT
    // re-invoke hub methods — without this, all chunks after a drop are lost.
    connection.onreconnected(async () => {
      try {
        await connection.invoke('JoinSession', session.sessionId);
        joinedSessionRef.current = session.sessionId;
        console.info('[Chatbot] SignalR reconnected, re-joined session', session.sessionId);
      } catch (err) {
        console.error('[Chatbot] Re-join session failed after reconnect', err);
      }
    });

    connection
      .start()
      .then(() => {
        connRef.current = connection;
        joinedSessionRef.current = session.sessionId;
        console.info('[Chatbot] SignalR connected, joining session', session.sessionId);
        return connection.invoke('JoinSession', session.sessionId);
      })
      .then(() => {
        console.info('[Chatbot] joined session group', session.sessionId);
      })
      .catch((err) => {
        console.error('[Chatbot] SignalR connect failed', err);
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
      console.info('[Chatbot] sending message', { session: session.sessionId, len: content.length });
      try {
        const res = await sendChatbotMessage({
          sessionId: session.sessionId,
          content,
          phone: phone ?? opts?.phone ?? null,
        });
        console.info('[Chatbot] sendMessage ACK', res);

        if (res.fromCache && res.cachedAnswer) {
          // Cache hit — answer is already complete, no streaming needed.
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
        } else {
          // Not cached — eagerly set streamingMessageId so the placeholder
          // renders a spinner immediately, before SignalR streamingStarted fires.
          setStreamingMessageId(res.assistantMessageId);
          setMessages((prev) => [
            ...prev,
            {
              id: res.assistantMessageId,
              role: 'assistant',
              content: '',
              createdAt: new Date().toISOString(),
            },
          ]);
        }
      } catch (err) {
        console.error('Chatbot sendMessage failed', err);
        setTyping(false);
        setStreamingMessageId(null);
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

  return { ready, session, messages, typing, streamingMessageId, error, sendMessage, resetSession };
}
