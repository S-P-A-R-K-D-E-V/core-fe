import { useRef, useState, useEffect, useCallback } from 'react';

import { type ChatbotSession, type ChatbotMessage } from 'src/api/chatbot';

// ----------------------------------------------------------------------
// Agent Middleware (SSE) — thay cho SignalR/ChatHub cũ. Route Handler proxy
// (`src/app/agent-chat/*`) tự forward JWT hoặc gắn X-Client-Api-Key server-side,
// nên hook này chỉ cần gọi same-origin `/agent-chat/*` (KHÔNG dưới /api — nginx-ingress `core-api` legacy route bắt hết /api/* về .NET backend, xem commit message), không cần biết URL/secret thật.
// ----------------------------------------------------------------------

const SESSION_STORAGE_KEY = 'chatbot.sessionId';
const SESSION_CREATED_AT_KEY = 'chatbot.sessionCreatedAt';
const GUEST_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

type SseDelta = { role?: string; content?: string };
type SseChoice = { delta: SseDelta; finish_reason: string | null };
type SseChunk = { id: string; choices: SseChoice[] };
type SseError = { error: { message: string; type: string } };

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

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function newGuestSessionId(): string {
  const fresh = crypto.randomUUID();
  localStorage.setItem(SESSION_STORAGE_KEY, fresh);
  localStorage.setItem(SESSION_CREATED_AT_KEY, String(Date.now()));
  return fresh;
}

// Mỗi user đăng nhập chỉ có ĐÚNG 1 session_id (suy trực tiếp từ user.id) — reload trang, đổi
// trình duyệt, hay localStorage bị xoá đều quay lại đúng phiên cũ trên server, không phụ thuộc
// localStorage còn nguyên vẹn hay không (khác hẳn cơ chế cũ chỉ dựa vào localStorage, dễ "mất
// lịch sử" khi localStorage bị clear/khác thiết bị). Khách ẩn danh không có identity ổn định nên
// vẫn dùng UUID lưu localStorage, nhưng tự hết hạn sau 24h theo yêu cầu.
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
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<ChatbotMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const loadingRef = useRef(false);

  const loadHistory = useCallback(async (id: string) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      // trailingSlash:true trong next.config.mjs — gọi thẳng URL có "/" cuối, không dựa vào
      // redirect 308 (không nhất quán giữa dev/prod và giữa các trình duyệt với POST).
      const res = await fetch(`/agent-chat/${id}/messages/?limit=20`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const items: ChatbotMessage[] = (data.items ?? []).map(
          (m: { role: string; content: string; createdAt: string }, idx: number) => ({
            id: `history-${idx}-${m.createdAt}`,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
          })
        );
        setMessages(items);
      }
    } catch (err) {
      console.error('[Chatbot] load history failed', err);
    } finally {
      loadingRef.current = false;
      setReady(true);
    }
  }, []);

  // 1. Bootstrap session_id (local, không cần round-trip server) + nạp lịch sử trang gần nhất.
  // Chạy lại khi userId đổi (vd. login ngay trong lúc widget đang mở) để chuyển từ session
  // khách sang session định danh theo user.
  useEffect(() => {
    const id = loadOrCreateSessionId(opts?.userId);
    setSessionId(id);
    setReady(false);
    if (id) loadHistory(id);
  }, [loadHistory, opts?.userId]);

  const sendMessage = useCallback(
    async (content: string, phone?: string | null) => {
      if (!sessionId || !content.trim()) return;
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
        const res = await fetch('/agent-chat/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            messages: [{ role: 'user', content }],
            session_id: sessionId,
            stream: true,
            customer_name: opts?.displayName || null,
            customer_phone: phone || opts?.phone || null,
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`agent-chat trả lỗi ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let assistantMessageId: string | null = null;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';

          for (const rawEvent of events) {
            const line = rawEvent.trim();
            if (!line.startsWith('data:')) continue;
            const payload = line.slice('data:'.length).trim();
            if (payload === '[DONE]') continue;

            let parsed: SseChunk | SseError;
            try {
              parsed = JSON.parse(payload);
            } catch {
              continue;
            }

            if ('error' in parsed) {
              setError(parsed.error.message);
              return;
            }

            const choice = parsed.choices?.[0];
            if (!choice) continue;
            const { delta } = choice;

            if (delta.content) {
              if (!assistantMessageId) {
                assistantMessageId = parsed.id;
                setStreamingMessageId(parsed.id);
                setMessages((prev) => [
                  ...prev,
                  { id: parsed.id, role: 'assistant', content: delta.content ?? '', createdAt: new Date().toISOString() },
                ]);
              } else {
                const msgId = assistantMessageId;
                setMessages((prev) => {
                  const idx = prev.findIndex((m) => m.id === msgId);
                  if (idx < 0) return prev;
                  const next = prev.slice();
                  next[idx] = { ...next[idx], content: next[idx].content + (delta.content ?? '') };
                  return next;
                });
              }
            }
          }
        }
      } catch (err) {
        console.error('[Chatbot] sendMessage failed', err);
        setError('Không gửi được tin nhắn');
      } finally {
        setTyping(false);
        setStreamingMessageId(null);
      }
    },
    [sessionId, opts?.phone, opts?.displayName]
  );

  const resetSession = useCallback(async () => {
    // "Phiên mới" = xoá hẳn phiên+lịch sử cũ trên server (mỗi user chỉ giữ 1 phiên), không phải
    // chỉ lờ đi. Với user đăng nhập, session_id giữ nguyên (suy từ userId) — xoá xong server trả
    // về rỗng, phiên "mới" tự nhiên bắt đầu từ id cũ đó. Guest thì đổi sang UUID mới.
    if (sessionId) {
      try {
        await fetch(`/agent-chat/${sessionId}`, { method: 'DELETE', headers: authHeaders() });
      } catch (err) {
        console.error('[Chatbot] delete session failed', err);
      }
    }
    const fresh = opts?.userId ? sessionId : newGuestSessionId();
    setSessionId(fresh);
    setMessages([]);
    setError(null);
    setReady(true);
  }, [sessionId, opts?.userId]);

  const session: ChatbotSession | null = sessionId
    ? {
        sessionId,
        ownerType: opts?.phone || opts?.displayName ? 'Customer' : 'Guest',
        agent: 'CustomerSupport',
        displayName: opts?.displayName ?? null,
        createdAt: new Date().toISOString(),
      }
    : null;

  return { ready, session, messages, typing, streamingMessageId, error, sendMessage, resetSession };
}
