import * as signalR from '@microsoft/signalr';
import { useRef, useState, useEffect, useCallback } from 'react';

import { HOST_API } from 'src/config-global';

import {
  type ChatbotSession,
  type ChatbotMessage,
  getChatbotMessages,
  sendChatbotMessage,
  startChatbotSession,
} from 'src/api/chatbot';

// ----------------------------------------------------------------------
// ChatHub (SignalR) + REST /chatbot/* trên core-be — KHÔNG qua "agent-middleware".
//
// Bối cảnh: 07/08/2026 widget từng được chuyển sang gọi 1 service Python riêng
// ("agent-middleware", qua proxy /agent-chat/*) để thay cho ChatHub/ChatbotController. Service đó
// chưa bao giờ được deploy thật (không có Deployment/Service nào tên "agent-middleware" trên
// cluster — xác nhận qua kubectl 2026-09-05), nên suốt 1 tháng qua chat KHÔNG hoạt động được trên
// production. Quay lại ChatHub/ChatbotController — đường này giờ đã đi qua SPARK AI Gateway +
// 9Router cho agent InternalAdmin (xem ChatOrchestrator.cs), có tool-calling thật, đã verify chạy
// ổn định bằng dữ liệu thật. `src/api/chatbot.ts` (REST) không hề bị đổi khi migrate sang
// agent-middleware nên dùng lại y nguyên.
//
// Giữ lại từ bản agent-middleware (đáng giữ, không liên quan tới chuyện dùng SignalR hay SSE):
// session theo userId (sống sót qua đổi thiết bị/xoá localStorage), guest TTL 24h, guard chống
// load lịch sử trùng lặp.
//
// MỚI so với cả 2 bản trước: lắng nghe event "status" (ChatHubNotifier.SendStatusAsync, thêm hôm
// nay) để hiện "đang gọi tool X…" — chỉ agent InternalAdmin mới phát event này (CustomerSupport
// không có tool), nên tự nhiên chỉ admin mới thấy, không cần gate thêm ở FE.
// ----------------------------------------------------------------------

const SESSION_STORAGE_KEY = 'chatbot.sessionId';
const SESSION_CREATED_AT_KEY = 'chatbot.sessionCreatedAt';
const GUEST_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

type StreamingStartedEvent = { sessionId: string; messageId: string };
type ChunkEvent = { sessionId: string; messageId: string; content: string };
type StatusEvent = {
  sessionId: string;
  messageId: string;
  kind: 'thinking' | 'tool';
  phase: 'start' | 'end' | 'error' | null;
  name: string | null;
  label: string;
  detail: string | null;
};
type CompletedEvent = { sessionId: string; messageId: string; content: string; fromCache: boolean };
type ErrorEvent = { sessionId: string; messageId: string; error: string };

export type ChatActivity = {
  kind: 'thinking' | 'tool';
  phase: 'start' | 'end' | 'error' | null;
  name: string | null;
  label: string;
  detail: string | null;
} | null;

export type ChatbotPanelState = {
  ready: boolean;
  session: ChatbotSession | null;
  messages: ChatbotMessage[];
  typing: boolean;
  streamingMessageId: string | null;
  /** Tool-calling progress của lượt trả lời đang stream (chỉ InternalAdmin có). null = không có gì đang chạy. */
  activity: ChatActivity;
  error: string | null;
  sendMessage: (content: string, phone?: string | null) => Promise<void>;
  resetSession: () => Promise<void>;
};

function newGuestSessionId(): string {
  const fresh = crypto.randomUUID();
  localStorage.setItem(SESSION_STORAGE_KEY, fresh);
  localStorage.setItem(SESSION_CREATED_AT_KEY, String(Date.now()));
  return fresh;
}

// Mỗi user đăng nhập chỉ có ĐÚNG 1 session_id (suy trực tiếp từ user.id) — reload trang, đổi
// trình duyệt, hay localStorage bị xoá đều quay lại đúng phiên cũ trên server. Khách ẩn danh dùng
// UUID lưu localStorage, tự hết hạn sau 24h.
function loadOrCreateSessionId(userId?: string | null): string {
  if (typeof window === 'undefined') return '';
  if (userId) return `user-${userId}`;

  const stored = localStorage.getItem(SESSION_STORAGE_KEY);
  const createdAt = Number(localStorage.getItem(SESSION_CREATED_AT_KEY) ?? 0);
  const expired = !createdAt || Date.now() - createdAt > GUEST_SESSION_TTL_MS;
  if (stored && !expired) return stored;
  return newGuestSessionId();
}

export function useChatbot(opts?: {
  phone?: string | null;
  displayName?: string | null;
  userId?: string | null;
}): ChatbotPanelState {
  const [session, setSession] = useState<ChatbotSession | null>(null);
  const [messages, setMessages] = useState<ChatbotMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [activity, setActivity] = useState<ChatActivity>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const connRef = useRef<signalR.HubConnection | null>(null);
  const loadingRef = useRef(false);

  // 1. Bootstrap session (local id trước, KHÔNG round-trip server) + start/resume + nạp lịch sử.
  useEffect(() => {
    let cancelled = false;
    const localId = loadOrCreateSessionId(opts?.userId);

    (async () => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setReady(false);
      try {
        const s = await startChatbotSession({
          sessionId: localId || null,
          phone: opts?.phone ?? null,
          displayName: opts?.displayName ?? null,
        });
        if (cancelled) return;
        setSession(s);
        if (typeof window !== 'undefined' && !opts?.userId) {
          localStorage.setItem(SESSION_STORAGE_KEY, s.sessionId);
        }

        const history = await getChatbotMessages(s.sessionId, 50);
        // Bỏ placeholder assistant rỗng mồ côi (stream bị ngắt giữa chừng) — không thì hiện "…" kẹt
        // mỗi lần load lại trang.
        const cleaned = history.filter(
          (m) => !(m.role === 'assistant' && (!m.content || m.content.trim() === ''))
        );
        if (!cancelled) setMessages(cleaned);
      } catch (err) {
        console.error('[Chatbot] init failed', err);
        if (!cancelled) setError('Không kết nối được chatbot');
      } finally {
        loadingRef.current = false;
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts?.userId, opts?.phone, opts?.displayName]);

  // 2. Connect SignalR + join group theo sessionId thật (từ server, không phải local id).
  useEffect(() => {
    if (!session?.sessionId) return undefined;

    const connection = new signalR.HubConnectionBuilder()
      // HOST_API rỗng ở prod → URL hub tương đối, đi qua ingress.
      .withUrl(`${HOST_API || ''}/hubs/chat`, {
        accessTokenFactory: () =>
          (typeof window !== 'undefined' && sessionStorage.getItem('accessToken')) || '',
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('streamingStarted', (ev: StreamingStartedEvent) => {
      if (ev.sessionId !== session.sessionId) return;
      setTyping(true);
      setStreamingMessageId(ev.messageId);
      setActivity(null);
      setMessages((prev) => {
        if (prev.some((m) => m.id === ev.messageId)) return prev;
        return [...prev, { id: ev.messageId, role: 'assistant', content: '', createdAt: new Date().toISOString() }];
      });
    });

    connection.on('status', (ev: StatusEvent) => {
      if (ev.sessionId !== session.sessionId) return;
      setActivity({ kind: ev.kind, phase: ev.phase, name: ev.name, label: ev.label, detail: ev.detail });
    });

    connection.on('chunk', (ev: ChunkEvent) => {
      if (ev.sessionId !== session.sessionId) return;
      setTyping(true);
      setStreamingMessageId(ev.messageId);
      // Nội dung đã bắt đầu chảy về — hoạt động tool (nếu có) của lượt này coi như xong.
      setActivity(null);
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === ev.messageId);
        if (idx >= 0) {
          const next = prev.slice();
          next[idx] = { ...next[idx], content: next[idx].content + ev.content };
          return next;
        }
        return [...prev, { id: ev.messageId, role: 'assistant', content: ev.content, createdAt: new Date().toISOString() }];
      });
    });

    connection.on('completed', (ev: CompletedEvent) => {
      if (ev.sessionId !== session.sessionId) return;
      setTyping(false);
      setStreamingMessageId(null);
      setActivity(null);
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === ev.messageId);
        if (idx < 0) return prev;
        const next = prev.slice();
        next[idx] = { ...next[idx], content: ev.content || next[idx].content };
        return next;
      });
    });

    connection.on('error', (ev: ErrorEvent) => {
      if (ev.sessionId !== session.sessionId) return;
      setTyping(false);
      setStreamingMessageId(null);
      setActivity(null);
      setError(ev.error);
    });

    connection.onreconnected(() => {
      connection.invoke('JoinSession', session.sessionId).catch((err) => {
        console.error('[Chatbot] re-join after reconnect failed', err);
      });
    });

    connection
      .start()
      .then(() => {
        connRef.current = connection;
        return connection.invoke('JoinSession', session.sessionId);
      })
      .catch((err) => {
        console.error('[Chatbot] SignalR connect failed', err);
      });

    return () => {
      connection.stop().catch(() => {});
      connRef.current = null;
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
      setActivity(null);
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
        } else {
          // Đặt streamingMessageId ngay — placeholder hiện spinner trước cả khi SignalR
          // "streamingStarted" tới.
          setStreamingMessageId(res.assistantMessageId);
          setMessages((prev) => [
            ...prev,
            { id: res.assistantMessageId, role: 'assistant', content: '', createdAt: new Date().toISOString() },
          ]);
        }
      } catch (err) {
        console.error('[Chatbot] sendMessage failed', err);
        setTyping(false);
        setStreamingMessageId(null);
        setError('Không gửi được tin nhắn');
      }
    },
    [session?.sessionId, opts?.phone]
  );

  const resetSession = useCallback(async () => {
    // Khách: đổi hẳn sang UUID mới -> phiên mới thật sự. User đăng nhập: session_id suy từ userId
    // nên không đổi được — backend hiện chưa có API xoá cứng, resetSession chỉ tải lại đúng phiên
    // đó (không phải regression, hành vi giống bản trước khi có agent-middleware).
    setMessages([]);
    setError(null);
    setActivity(null);
    setReady(false);
    try {
      const nextId = opts?.userId ? session?.sessionId || null : newGuestSessionId();
      const s = await startChatbotSession({
        sessionId: nextId,
        phone: opts?.phone ?? null,
        displayName: opts?.displayName ?? null,
      });
      setSession(s);
      if (typeof window !== 'undefined' && !opts?.userId) {
        localStorage.setItem(SESSION_STORAGE_KEY, s.sessionId);
      }
      const history = await getChatbotMessages(s.sessionId, 50);
      setMessages(history.filter((m) => !(m.role === 'assistant' && (!m.content || m.content.trim() === ''))));
    } catch (err) {
      console.error('[Chatbot] resetSession failed', err);
      setError('Không tạo được phiên mới');
    } finally {
      setReady(true);
    }
  }, [session?.sessionId, opts?.userId, opts?.phone, opts?.displayName]);

  return { ready, session, messages, typing, streamingMessageId, activity, error, sendMessage, resetSession };
}
