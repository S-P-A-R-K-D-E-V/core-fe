import * as signalR from '@microsoft/signalr';
import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import { HOST_API } from 'src/config-global';

import {
  type ChatbotStep,
  type ChatbotTier,
  type ChatbotAgent,
  type ChatbotBlock,
  type ChatbotSession,
  type ChatbotMessage,
  getChatbotMessages,
  sendChatbotMessage,
  startChatbotSession,
  CHATBOT_MAX_CONTENT_LENGTH,
} from 'src/api/chatbot';

// ----------------------------------------------------------------------
// ChatHub (SignalR) + REST /chatbot/* trên core-be — KHÔNG qua "agent-middleware".
//
// Bối cảnh: 07/08/2026 widget từng được chuyển sang gọi 1 service Python riêng
// ("agent-middleware", qua proxy /agent-chat/*) để thay cho ChatHub/ChatbotController. Service đó
// chưa bao giờ được deploy thật, nên suốt 1 tháng chat KHÔNG hoạt động trên production. Quay lại
// ChatHub/ChatbotController — đường này đi qua SPARK AI Gateway + 9Router cho agent
// InternalAdmin/Staff (xem ChatOrchestrator.cs), có tool-calling thật.
//
// Hợp đồng trợ lý v1 (core-be ChatHubNotifier / AssistantMessageJson):
//   - REST: POST /chatbot/sessions {sessionId, phone, displayName, newSession}, GET .../messages,
//     POST /chatbot/messages.
//   - SignalR nhóm theo phiên: streamingStarted → (status | step | chunk)* → completed | error.
//     completed mang bản chính thức (content đã bỏ khối máy) + blocks/steps; error mang partial.
//
// Những điểm hook này phải giữ đúng:
//   1. "Trò chuyện mới" tạo phiên MỚI THẬT trên server (newSession) — không có cờ đó server nối lại
//      phiên gần nhất của người đăng nhập nên nút cũ không làm gì.
//   2. Bootstrap theo kiểu "yêu cầu mới nhất thắng": userId/phone/displayName đổi giữa chừng (khách
//      cũ quay lại, vừa đăng nhập xong, StrictMode) thì kết quả của lượt cũ bị bỏ, lượt mới luôn kết
//      thúc bằng ready=true. Bản trước dùng cờ loadingRef nên lượt 2 thoát sớm trong khi lượt 1 đã
//      bị huỷ → ready kẹt false mãi.
//   3. Không bao giờ "quay mãi": sự kiện tới trước phản hồi REST không tạo bong bóng trùng; error
//      không để lại chỗ giữ chỗ rỗng; JoinSession bị từ chối / lỗi thì báo lỗi; đang chờ trả lời mà
//      im lặng 120 giây thì hỏi lại REST một lần rồi báo lỗi.
// ----------------------------------------------------------------------

const SESSION_STORAGE_KEY = 'chatbot.sessionId';
const SESSION_CREATED_AT_KEY = 'chatbot.sessionCreatedAt';
const GUEST_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const HISTORY_LIMIT = 50;
/** Số tin cuối tải lại để đối chiếu khi nghi lỡ sự kiện (im lặng quá lâu / vừa kết nối lại). */
const RECONCILE_LIMIT = 20;
/** Đang chờ câu trả lời mà không có sự kiện nào trong ngần này → dừng quay, báo lỗi. */
export const REPLY_SILENCE_MS = 120_000;
/** Chờ vào được nhóm SignalR của phiên trước khi gửi câu hỏi (gửi sớm hơn thì lỡ sự kiện đầu). */
const JOIN_WAIT_MS = 8_000;

const BOOT_ERROR = 'Không kết nối được trợ lý. Vui lòng thử lại.';
const NEW_SESSION_ERROR = 'Không tạo được cuộc trò chuyện mới. Vui lòng thử lại.';
const SEND_ERROR = 'Không gửi được tin nhắn. Vui lòng thử lại.';
/** Mất kênh SignalR lúc đang chờ câu trả lời / lúc gửi câu hỏi. */
const HUB_ERROR =
  'Mất kết nối trực tiếp tới trợ lý nên chưa nhận được câu trả lời. Vui lòng thử lại.';
/** Mất kênh SignalR lúc không có gì đang chờ — tự nối lại khi gửi tin, khi có mạng lại, khi quay lại tab. */
const HUB_IDLE_ERROR = 'Mất kết nối tới trợ lý. Sẽ tự kết nối lại khi bạn gửi tin nhắn.';
const TIMEOUT_ERROR = 'Trợ lý phản hồi quá lâu. Vui lòng thử lại.';
const REPLY_ERROR = 'Câu trả lời bị gián đoạn. Vui lòng thử lại.';
const EMPTY_REPLY_ERROR = 'Trợ lý chưa trả lời được câu này. Bạn thử hỏi lại theo cách khác nhé.';
const NO_SESSION_ERROR = 'Chưa kết nối được trợ lý. Vui lòng thử lại.';

// ----------------------------------------------------------------------

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
type StepEvent = { sessionId: string; messageId: string; step: ChatbotStep };
type CompletedEvent = {
  sessionId: string;
  messageId: string;
  content?: string | null;
  fromCache?: boolean;
  v?: number;
  status?: string;
  blocks?: ChatbotBlock[] | null;
  steps?: ChatbotStep[] | null;
};
type ErrorEvent = {
  sessionId: string;
  messageId?: string | null;
  error?: string | null;
  code?: string | null;
  retryable?: boolean;
  partial?: string | null;
};

export type ChatActivity = {
  kind: 'thinking' | 'tool';
  phase: 'start' | 'end' | 'error' | null;
  name: string | null;
  label: string;
  detail: string | null;
} | null;

/** Trạng thái kênh SignalR của phiên hiện tại. */
export type ChatbotConnection = 'connecting' | 'ready' | 'error';

export type ChatbotPanelState = {
  /** Đã có phiên + lịch sử (REST) — chưa xong thì chưa gửi được. */
  ready: boolean;
  session: ChatbotSession | null;
  /** Trợ lý server chọn cho người hỏi (null khi chưa có phiên). */
  agent: ChatbotAgent | null;
  tier: ChatbotTier | null;
  messages: ChatbotMessage[];
  /** Đang có câu trả lời chạy (đang gửi câu hỏi hoặc đang chờ / đang stream). */
  typing: boolean;
  /** Cùng nghĩa với `typing` — tên rõ hơn cho UI khoá nút gửi. */
  busy: boolean;
  streamingMessageId: string | null;
  /** Tiến độ của lượt trả lời đang stream (đang suy nghĩ / đang gọi tool). null = không có gì. */
  activity: ChatActivity;
  connection: ChatbotConnection;
  error: string | null;
  /** Lượt hỏi gần nhất thất bại (gửi lỗi / trả lời lỗi / quá lâu) — UI mời "Sửa và gửi lại". */
  turnFailed: boolean;
  /** Câu gần nhất người dùng đã gửi — để đưa lại vào ô nhập. */
  lastUserText: string | null;
  /** Thời điểm (máy) câu trả lời gần nhất hoàn tất — UI dùng cho chấm "chưa đọc". */
  lastReplyAt: number | null;
  /** true = server đã nhận câu hỏi. */
  sendMessage: (content: string, phone?: string | null) => Promise<boolean>;
  /** Tạo phiên mới thật trên server rồi thay phiên + tin nhắn. true = thành công. */
  startNewSession: () => Promise<boolean>;
  /** Tên cũ của startNewSession (trang Chatbot nội bộ còn dùng). */
  resetSession: () => Promise<boolean>;
  /** Mở lại phiên (start / resume) sau khi không kết nối được — không tạo phiên mới. */
  reconnect: () => void;
};

// ---------------------------------------------------------------------- id phiên của khách

function newGuestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Trang không chạy trên https (dev qua IP LAN) không có randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r % 4) + 8).toString(16);
  });
}

function rememberGuestSession(id: string, resetClock: boolean) {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, id);
    if (resetClock) localStorage.setItem(SESSION_CREATED_AT_KEY, String(Date.now()));
  } catch {
    /* localStorage bị chặn — phiên chỉ sống trong tab này */
  }
}

// Khách ẩn danh: id phiên lưu localStorage, tự hết hạn sau 24h (khớp TTL phiên khách phía server).
function loadOrCreateGuestSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    const createdAt = Number(localStorage.getItem(SESSION_CREATED_AT_KEY) ?? 0);
    const expired = !createdAt || Date.now() - createdAt > GUEST_SESSION_TTL_MS;
    if (stored && !expired) return stored;
  } catch {
    return newGuestId();
  }
  const fresh = newGuestId();
  rememberGuestSession(fresh, true);
  return fresh;
}

// ---------------------------------------------------------------------- hàm thuần trên danh sách tin

function newPlaceholder(id: string): ChatbotMessage {
  return {
    id,
    role: 'assistant',
    content: '',
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
}

function isBlank(m: ChatbotMessage): boolean {
  return !(m.content && m.content.trim()) && !(Array.isArray(m.blocks) && m.blocks.length > 0);
}

/** Tin người dùng gửi không tới được server (chỉ có ở máy). */
function isFailedLocal(m: ChatbotMessage): boolean {
  return m.role === 'user' && m.status === 'error' && m.id.startsWith('local-');
}

/** Sửa tin trợ lý theo id; chưa có (sự kiện tới trước phản hồi REST, join muộn) thì tạo ở cuối. */
function patchAssistant(
  list: ChatbotMessage[],
  id: string,
  patch: (m: ChatbotMessage) => ChatbotMessage
): ChatbotMessage[] {
  const idx = list.findIndex((m) => m.id === id);
  if (idx < 0) return [...list, patch(newPlaceholder(id))];
  const next = list.slice();
  next[idx] = patch(next[idx]);
  return next;
}

function ensureAssistant(list: ChatbotMessage[], id: string): ChatbotMessage[] {
  return list.some((m) => m.id === id) ? list : [...list, newPlaceholder(id)];
}

function upsertStep(steps: ChatbotStep[] | null | undefined, step: ChatbotStep): ChatbotStep[] {
  const list = steps ?? [];
  const idx = list.findIndex((s) => s.id === step.id);
  if (idx < 0) return [...list, step];
  const next = list.slice();
  next[idx] = { ...next[idx], ...step };
  return next;
}

/** Chốt các bước còn "đang chạy" khi câu trả lời kết thúc. */
function settleSteps(
  steps: ChatbotStep[] | null | undefined,
  to: 'done' | 'error'
): ChatbotStep[] | null {
  if (!steps || steps.length === 0) return null;
  return steps.map((s) => (s.state === 'running' ? { ...s, state: to } : s));
}

/**
 * Câu trả lời kết thúc bằng lỗi: giữ phần đã trả lời (partial của server là bản chính thức, không có
 * thì phần đã stream) và đánh dấu lỗi; chưa có chữ nào → bỏ hẳn chỗ giữ chỗ (không để "…" kẹt).
 */
function failAssistant(
  list: ChatbotMessage[],
  id: string,
  partial?: string | null,
  code?: string | null
): ChatbotMessage[] {
  const idx = list.findIndex((m) => m.id === id);
  const current = idx >= 0 ? list[idx] : null;
  const content =
    (typeof partial === 'string' && partial.trim() ? partial : current?.content) ?? '';

  if (!content.trim()) return idx >= 0 ? list.filter((_, i) => i !== idx) : list;

  const failed: ChatbotMessage = {
    ...(current ?? newPlaceholder(id)),
    content,
    status: 'error',
    errorCode: code || 'internal',
    steps: settleSteps(current?.steps, 'error'),
  };
  if (idx < 0) return [...list, failed];
  const next = list.slice();
  next[idx] = failed;
  return next;
}

// Bỏ chỗ giữ chỗ rỗng của trợ lý (stream bị ngắt / lỗi không có chữ) — không thì hiện bong bóng "…"
// kẹt mỗi lần tải lại. Sự kiện SignalR tới sau (nếu câu đó còn đang chạy) sẽ tự tạo lại.
function cleanHistory(history: unknown): ChatbotMessage[] {
  if (!Array.isArray(history)) return [];
  return (history as ChatbotMessage[]).filter(
    (m) => !!m && !(m.role === 'assistant' && isBlank(m))
  );
}

/** Tin cuối của lịch sử là câu trả lời lỗi → mời người dùng gửi lại. */
function lastTurnFailed(history: unknown): boolean {
  if (!Array.isArray(history) || history.length === 0) return false;
  const last = history[history.length - 1] as ChatbotMessage | undefined;
  return !!last && last.role === 'assistant' && last.status === 'error';
}

function withTimeout(promise: Promise<boolean>, ms: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(false);
      }
    );
  });
}

class HubNotReadyError extends Error {}

type HubHandle = { sessionId: string; ensureJoined: () => Promise<boolean> };
type PostToken = { localId: string };
type ReplyResult = {
  content?: string | null;
  fromCache?: boolean;
  v?: number;
  blocks?: ChatbotBlock[] | null;
  steps?: ChatbotStep[] | null;
};

// ----------------------------------------------------------------------

export function useChatbot(opts?: {
  phone?: string | null;
  displayName?: string | null;
  userId?: string | null;
  /**
   * false = chưa mở phiên (vd trạng thái đăng nhập còn đang tải nên chưa biết ai đang hỏi) — tránh tạo
   * một phiên khách thừa rồi mở lại ngay bằng phiên của người đăng nhập. Mặc định true.
   */
  enabled?: boolean;
}): ChatbotPanelState {
  const userId = opts?.userId ?? null;
  const phone = opts?.phone ?? null;
  const displayName = opts?.displayName ?? null;
  const enabled = opts?.enabled ?? true;

  const [session, setSession] = useState<ChatbotSession | null>(null);
  const [messages, setMessages] = useState<ChatbotMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [activity, setActivity] = useState<ChatActivity>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [connection, setConnection] = useState<ChatbotConnection>('connecting');
  const [turnFailed, setTurnFailed] = useState(false);
  const [lastReplyAt, setLastReplyAt] = useState<number | null>(null);
  /** Tăng lên để chạy lại bootstrap theo yêu cầu (reconnect). */
  const [bootNonce, setBootNonce] = useState(0);

  const mountedRef = useRef(true);
  /** Số thứ tự yêu cầu mở phiên (bootstrap + trò chuyện mới) — chỉ yêu cầu mới nhất được ghi state. */
  const requestSeqRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  /** Bản mới nhất của danh sách tin — mọi thay đổi đi qua mutate() nên đọc đồng bộ được. */
  const messagesRef = useRef<ChatbotMessage[]>([]);
  /** Các POST /chatbot/messages đang chờ của phiên hiện tại. */
  const postingRef = useRef<Set<PostToken>>(new Set());
  /** Id các câu trả lời đang chờ / đang stream. */
  const inFlightRef = useRef<Set<string>>(new Set());
  /** Id các câu trả lời đã kết thúc (completed / error / hết giờ) — bỏ qua sự kiện tới muộn. */
  const finishedRef = useRef<Set<string>>(new Set());
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceHandlerRef = useRef<() => void>(() => {});
  const hubRef = useRef<HubHandle | null>(null);
  const localSeqRef = useRef(0);

  const mutate = useCallback((fn: (list: ChatbotMessage[]) => ChatbotMessage[]) => {
    const next = fn(messagesRef.current);
    if (next === messagesRef.current) return;
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const syncBusy = useCallback(() => {
    const ids = inFlightRef.current;
    const active = postingRef.current.size > 0 || ids.size > 0;
    setTyping(active);
    setStreamingMessageId((prev) =>
      prev && ids.has(prev) ? prev : (Array.from(ids).pop() ?? null)
    );
    if (!active) setActivity(null);
  }, []);

  const disarmWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  /** Đặt lại đồng hồ im lặng — gọi mỗi khi gửi câu hỏi hoặc có sự kiện của phiên. */
  const armWatchdog = useCallback(() => {
    disarmWatchdog();
    if (postingRef.current.size === 0 && inFlightRef.current.size === 0) return;
    watchdogRef.current = setTimeout(() => {
      watchdogRef.current = null;
      silenceHandlerRef.current();
    }, REPLY_SILENCE_MS);
  }, [disarmWatchdog]);

  /** Bắt đầu theo dõi một câu trả lời. false = câu đó đã kết thúc rồi (sự kiện tới muộn). */
  const beginReply = useCallback(
    (id: string): boolean => {
      if (finishedRef.current.has(id)) return false;
      if (!inFlightRef.current.has(id)) {
        inFlightRef.current.add(id);
        setError(null);
        setTurnFailed(false);
      }
      setStreamingMessageId(id);
      setTyping(true);
      armWatchdog();
      return true;
    },
    [armWatchdog]
  );

  /** Câu trả lời hoàn tất (sự kiện completed, câu trả lời từ cache, hoặc đối chiếu REST). */
  const finishReply = useCallback(
    (id: string, result: ReplyResult) => {
      inFlightRef.current.delete(id);
      finishedRef.current.add(id);

      const current = messagesRef.current.find((m) => m.id === id);
      // content của completed là bản chính thức (đã bỏ khối máy); rỗng thì giữ phần đã stream.
      const content =
        (typeof result.content === 'string' && result.content) || current?.content || '';
      const blocks =
        Array.isArray(result.blocks) && result.blocks.length > 0
          ? result.blocks
          : (current?.blocks ?? null);

      if (!content.trim() && !(blocks && blocks.length > 0)) {
        // Model không viết gì: không để bong bóng rỗng — coi như lượt hỏi thất bại.
        mutate((list) => list.filter((m) => m.id !== id));
        setError(EMPTY_REPLY_ERROR);
        setTurnFailed(true);
      } else {
        mutate((list) =>
          patchAssistant(list, id, (m) => ({
            ...m,
            content,
            fromCache: result.fromCache ?? m.fromCache,
            v: result.v ?? m.v,
            status: 'complete',
            errorCode: null,
            blocks,
            steps: settleSteps(Array.isArray(result.steps) ? result.steps : m.steps, 'done'),
          }))
        );
        setError(null);
        setTurnFailed(false);
        setLastReplyAt(Date.now());
      }
      syncBusy();
      armWatchdog();
    },
    [mutate, syncBusy, armWatchdog]
  );

  /** Câu trả lời kết thúc bằng lỗi (sự kiện error hoặc đối chiếu REST). */
  const failReply = useCallback(
    (
      id: string,
      failure: { partial?: string | null; code?: string | null; text?: string | null }
    ) => {
      inFlightRef.current.delete(id);
      finishedRef.current.add(id);
      mutate((list) => failAssistant(list, id, failure.partial, failure.code));
      setError(failure.text || REPLY_ERROR);
      setTurnFailed(true);
      syncBusy();
      armWatchdog();
    },
    [mutate, syncBusy, armWatchdog]
  );

  /** Bỏ mọi thứ đang chờ (hết giờ / mất kênh SignalR): dừng quay, giữ phần đã trả lời, báo lỗi. */
  const failPending = useCallback(
    (text: string, code: string) => {
      const replyIds = Array.from(inFlightRef.current);
      const localIds = Array.from(postingRef.current).map((t) => t.localId);
      inFlightRef.current = new Set();
      postingRef.current = new Set();
      disarmWatchdog();
      if (replyIds.length === 0 && localIds.length === 0) return false;

      replyIds.forEach((id) => finishedRef.current.add(id));
      mutate((list) => {
        let next = list;
        replyIds.forEach((id) => {
          next = failAssistant(next, id, null, code);
        });
        if (localIds.length > 0) {
          next = next.map((m) =>
            localIds.includes(m.id) ? { ...m, status: 'error' as const } : m
          );
        }
        return next;
      });
      setError(text);
      setTurnFailed(true);
      syncBusy();
      return true;
    },
    [mutate, syncBusy, disarmWatchdog]
  );

  /**
   * Hỏi lại REST các câu đang chờ: server đã lưu bản cuối (complete / error) mà máy lỡ sự kiện (rớt
   * mạng, vừa kết nối lại) thì áp luôn; còn pending thì để nguyên.
   */
  const reconcile = useCallback(
    async (sid: string) => {
      if (inFlightRef.current.size === 0) return;
      let server: ChatbotMessage[];
      try {
        server = await getChatbotMessages(sid, RECONCILE_LIMIT);
      } catch {
        return; // mất mạng — để watchdog quyết định
      }
      if (sessionIdRef.current !== sid || !Array.isArray(server)) return;

      Array.from(inFlightRef.current).forEach((id) => {
        const found = server.find((m) => m.id === id);
        if (!found || found.role !== 'assistant') return;
        const status = found.status ?? (isBlank(found) ? 'pending' : 'complete');
        if (status === 'complete') {
          finishReply(id, {
            content: found.content,
            fromCache: found.fromCache,
            v: found.v,
            blocks: found.blocks,
            steps: found.steps,
          });
        } else if (status === 'error') {
          failReply(id, { partial: found.content, code: found.errorCode });
        }
      });
    },
    [finishReply, failReply]
  );

  // Watchdog: đang chờ mà im lặng REPLY_SILENCE_MS → đối chiếu REST lần chót, vẫn chưa xong thì báo lỗi.
  // Đi qua ref vì armWatchdog (được finishReply/failReply gọi) không thể phụ thuộc ngược lại reconcile.
  useEffect(() => {
    silenceHandlerRef.current = () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      void reconcile(sid).then(() => {
        if (!mountedRef.current || sessionIdRef.current !== sid) return;
        // Đồng hồ đã được đặt lại trong lúc chờ REST (có sự kiện mới, hoặc REST vừa chốt được một
        // câu mà còn câu khác đang chờ) → câu trả lời vẫn sống, chưa báo lỗi.
        if (watchdogRef.current) return;
        failPending(TIMEOUT_ERROR, 'timeout');
      });
    };
  }, [reconcile, failPending]);

  /** Thay phiên: bỏ mọi trạng thái của phiên cũ, nạp lịch sử phiên mới. */
  const applySession = useCallback(
    (next: ChatbotSession, history: unknown) => {
      sessionIdRef.current = next.sessionId;
      inFlightRef.current = new Set();
      finishedRef.current = new Set();
      postingRef.current = new Set();
      disarmWatchdog();
      messagesRef.current = cleanHistory(history);

      setSession(next);
      setMessages(messagesRef.current);
      setTyping(false);
      setStreamingMessageId(null);
      setActivity(null);
      setError(null);
      setTurnFailed(lastTurnFailed(history));
    },
    [disarmWatchdog]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      disarmWatchdog();
    };
  }, [disarmWatchdog]);

  // 1. Bootstrap: start/resume phiên + nạp lịch sử. "Yêu cầu mới nhất thắng" — xem ghi chú đầu file.
  useEffect(() => {
    if (!enabled) return;

    requestSeqRef.current += 1;
    const seq = requestSeqRef.current;
    const isLatest = () => mountedRef.current && requestSeqRef.current === seq;
    setReady(false);

    (async () => {
      try {
        const started = await startChatbotSession({
          // Người đăng nhập: server tự nối lại phiên gần nhất của họ theo JWT (đổi thiết bị / xoá
          // localStorage vẫn về đúng phiên). Khách: theo id lưu ở máy.
          sessionId: userId ? null : loadOrCreateGuestSessionId(),
          phone,
          displayName,
        });
        if (!isLatest()) return;
        const history = await getChatbotMessages(started.sessionId, HISTORY_LIMIT);
        if (!isLatest()) return;
        if (!userId) rememberGuestSession(started.sessionId, false);
        applySession(started, history);
      } catch (err) {
        if (!isLatest()) return;
        console.error('[Chatbot] init failed', err);
        // Không giữ phiên của danh tính cũ (vd vừa đăng xuất mà lượt mở phiên khách bị lỗi).
        sessionIdRef.current = null;
        inFlightRef.current = new Set();
        finishedRef.current = new Set();
        postingRef.current = new Set();
        disarmWatchdog();
        messagesRef.current = [];
        setSession(null);
        setMessages([]);
        setTyping(false);
        setStreamingMessageId(null);
        setActivity(null);
        setTurnFailed(false);
        setError(BOOT_ERROR);
      } finally {
        if (isLatest()) setReady(true);
      }
    })();
  }, [enabled, userId, phone, displayName, bootNonce, applySession, disarmWatchdog]);

  // 2. SignalR: mỗi phiên một kết nối (token lấy lúc kết nối nên đổi danh tính = đổi phiên = kết nối
  //    mới). Đổi phiên → effect chạy lại: rời nhóm cũ + đóng kết nối cũ, mở kết nối mới + join nhóm mới.
  useEffect(() => {
    const sessionId = session?.sessionId;
    if (!sessionId) return undefined;

    let disposed = false;
    let joining: Promise<boolean> | null = null;
    setConnection('connecting');

    const connection = new signalR.HubConnectionBuilder()
      // HOST_API rỗng ở prod → URL hub tương đối, đi qua ingress.
      .withUrl(`${HOST_API || ''}/hubs/chat`, {
        accessTokenFactory: () =>
          (typeof window !== 'undefined' && sessionStorage.getItem('accessToken')) || '',
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    const mine = (ev?: { sessionId?: string } | null): boolean =>
      !disposed && !!ev && ev.sessionId === sessionId;

    connection.on('streamingStarted', (ev: StreamingStartedEvent) => {
      if (!mine(ev) || !ev.messageId) return;
      // Thử lại (app khác cùng phiên) dùng lại đúng id tin → xoá phần trả lời / lỗi cũ.
      finishedRef.current.delete(ev.messageId);
      beginReply(ev.messageId);
      setActivity(null);
      mutate((list) =>
        patchAssistant(list, ev.messageId, (m) => ({
          ...m,
          content: '',
          status: 'pending',
          errorCode: null,
          blocks: null,
          steps: null,
        }))
      );
    });

    connection.on('status', (ev: StatusEvent) => {
      if (!mine(ev) || !ev.messageId) return;
      if (!beginReply(ev.messageId)) return;
      mutate((list) => ensureAssistant(list, ev.messageId));
      setActivity(
        ev.phase === 'end' || ev.phase === 'error'
          ? null
          : { kind: ev.kind, phase: ev.phase, name: ev.name, label: ev.label, detail: ev.detail }
      );
    });

    connection.on('step', (ev: StepEvent) => {
      if (!mine(ev) || !ev.messageId || !ev.step || !ev.step.id) return;
      if (!beginReply(ev.messageId)) return;
      mutate((list) =>
        patchAssistant(list, ev.messageId, (m) => ({
          ...m,
          status: 'pending',
          steps: upsertStep(m.steps, ev.step),
        }))
      );
    });

    connection.on('chunk', (ev: ChunkEvent) => {
      if (!mine(ev) || !ev.messageId || !ev.content) return;
      if (!beginReply(ev.messageId)) return;
      // Nội dung đã bắt đầu chảy về — hoạt động tool (nếu có) của lượt này coi như xong.
      setActivity(null);
      mutate((list) =>
        patchAssistant(list, ev.messageId, (m) => ({
          ...m,
          content: (m.content || '') + ev.content,
          status: 'pending',
        }))
      );
    });

    connection.on('completed', (ev: CompletedEvent) => {
      if (!mine(ev) || !ev.messageId) return;
      finishReply(ev.messageId, ev);
    });

    connection.on('error', (ev: ErrorEvent) => {
      if (!mine(ev)) return;
      if (ev.messageId) {
        failReply(ev.messageId, { partial: ev.partial, code: ev.code, text: ev.error });
      } else if (!failPending(ev.error || REPLY_ERROR, ev.code || 'internal')) {
        setError(ev.error || REPLY_ERROR);
      }
    });

    const hubFailed = (reason: unknown) => {
      if (disposed) return;
      console.error('[Chatbot] SignalR không vào được nhóm của phiên', reason);
      setConnection('error');
      // Không còn kênh nhận câu trả lời: câu đang chờ sẽ không bao giờ tới → dừng quay, báo lỗi.
      if (!failPending(HUB_ERROR, 'connection')) setError(HUB_IDLE_ERROR);
    };

    const ensureJoined = (): Promise<boolean> => {
      if (disposed) return Promise.resolve(false);
      if (joining) return joining;

      const attempt = (async () => {
        try {
          if (connection.state === signalR.HubConnectionState.Disconnected) {
            await connection.start();
          }
          if (disposed) return false;
          const accepted = await connection.invoke<boolean | null | undefined>(
            'JoinSession',
            sessionId
          );
          // false = phiên không tồn tại / không phải của người đang kết nối. Server cũ trả void.
          if (accepted === false) throw new Error('JoinSession bị từ chối');
          if (disposed) return false;
          setConnection('ready');
          setError((prev) => (prev === HUB_ERROR || prev === HUB_IDLE_ERROR ? null : prev));
          return true;
        } catch (err) {
          hubFailed(err);
          return false;
        }
      })();

      joining = attempt;
      // Thất bại thì lần gửi sau được thử lại từ đầu.
      attempt.then((ok) => {
        if (!ok && joining === attempt) joining = null;
      });
      return attempt;
    };

    connection.onreconnecting(() => {
      if (!disposed) setConnection('connecting');
    });

    connection.onreconnected(() => {
      if (disposed) return;
      // Kết nối mới không còn trong nhóm — join lại rồi đối chiếu những gì lỡ trong lúc rớt mạng.
      joining = null;
      ensureJoined().then((ok) => {
        if (ok && !disposed) void reconcile(sessionId);
      });
    });

    connection.onclose(() => {
      if (disposed) return;
      joining = null;
      hubFailed(new Error('kết nối SignalR đã đóng'));
    });

    // Kết nối đã đóng hẳn (hết lượt tự nối lại: máy ngủ, mất mạng lâu) → có mạng lại / quay lại tab
    // thì nối lại, không đợi người dùng gửi tin.
    const retryWhenBack = () => {
      if (disposed || document.visibilityState === 'hidden') return;
      if (connection.state === signalR.HubConnectionState.Disconnected) void ensureJoined();
    };
    window.addEventListener('online', retryWhenBack);
    document.addEventListener('visibilitychange', retryWhenBack);

    hubRef.current = { sessionId, ensureJoined };
    void ensureJoined();

    return () => {
      disposed = true;
      window.removeEventListener('online', retryWhenBack);
      document.removeEventListener('visibilitychange', retryWhenBack);
      if (hubRef.current && hubRef.current.sessionId === sessionId) hubRef.current = null;
      // Rời nhóm của phiên cũ rồi đóng kết nối (đóng kết nối thì server cũng tự gỡ khỏi nhóm).
      if (connection.state === signalR.HubConnectionState.Connected) {
        connection.invoke('LeaveSession', sessionId).catch(() => {});
      }
      connection.stop().catch(() => {});
    };
  }, [session?.sessionId, mutate, beginReply, finishReply, failReply, failPending, reconcile]);

  const sendMessage = useCallback(
    async (content: string, phoneOverride?: string | null): Promise<boolean> => {
      const text = (content ?? '').trim();
      if (!text) return false;

      const sid = sessionIdRef.current;
      if (!sid) {
        setError(NO_SESSION_ERROR);
        return false;
      }
      if (text.length > CHATBOT_MAX_CONTENT_LENGTH) {
        setError(`Tin nhắn dài quá ${CHATBOT_MAX_CONTENT_LENGTH} ký tự.`);
        return false;
      }

      localSeqRef.current += 1;
      const localId = `local-${Date.now()}-${localSeqRef.current}`;
      const token: PostToken = { localId };
      postingRef.current.add(token);
      // Bỏ tin gửi lỗi của lượt trước (người dùng đang gửi lại) rồi hiện ngay tin mới.
      mutate((list) => [
        ...list.filter((m) => !isFailedLocal(m)),
        { id: localId, role: 'user', content: text, createdAt: new Date().toISOString() },
      ]);
      setError(null);
      setTurnFailed(false);
      setActivity(null);
      syncBusy();
      armWatchdog();

      // Bị bỏ giữa chừng: đã đổi phiên, hoặc watchdog đã báo lỗi lượt này.
      const abandoned = () => !postingRef.current.has(token);

      try {
        const hub = hubRef.current;
        if (hub && hub.sessionId === sid) {
          const joined = await withTimeout(hub.ensureJoined(), JOIN_WAIT_MS);
          if (abandoned()) return false;
          if (!joined) throw new HubNotReadyError();
        }

        const res = await sendChatbotMessage({
          sessionId: sid,
          content: text,
          phone: phoneOverride ?? phone,
        });
        if (abandoned()) return false;
        postingRef.current.delete(token);

        if (res.fromCache && res.cachedAnswer) {
          finishReply(res.assistantMessageId, { content: res.cachedAnswer, fromCache: true });
        } else if (beginReply(res.assistantMessageId)) {
          // Chỗ giữ chỗ hiện "đang trả lời" trước cả khi SignalR tới; nếu streamingStarted / chunk
          // đã tới trước phản hồi REST thì tin đã có sẵn — không thêm trùng.
          mutate((list) => ensureAssistant(list, res.assistantMessageId));
        } else {
          // Câu trả lời đã kết thúc trước cả khi REST trả về (trả lời cố định rất nhanh).
          syncBusy();
        }
        return true;
      } catch (err) {
        if (abandoned()) return false;
        postingRef.current.delete(token);
        console.error('[Chatbot] sendMessage failed', err);
        mutate((list) =>
          list.map((m) => (m.id === localId ? { ...m, status: 'error' as const } : m))
        );
        setError(err instanceof HubNotReadyError ? HUB_ERROR : SEND_ERROR);
        setTurnFailed(true);
        syncBusy();
        armWatchdog();
        return false;
      }
    },
    [phone, mutate, syncBusy, armWatchdog, beginReply, finishReply]
  );

  const startNewSession = useCallback(async (): Promise<boolean> => {
    requestSeqRef.current += 1;
    const seq = requestSeqRef.current;
    const isLatest = () => mountedRef.current && requestSeqRef.current === seq;
    setReady(false);

    try {
      const started = await startChatbotSession(
        userId
          ? // Người đăng nhập: newSession → server luôn tạo phiên mới, phiên cũ giữ làm lưu trữ.
            { sessionId: null, phone, displayName, newSession: true }
          : // Khách: server BỎ QUA newSession với khách và nối lại phiên gần nhất theo SĐT
            // (ChatOrchestrator.StartOrResumeSessionAsync) — nên gửi id mới tinh và KHÔNG kèm SĐT ở
            // lời gọi này để chắc chắn ra phiên mới. SĐT vẫn đi kèm từng câu hỏi (sendMessage) nên
            // ngữ cảnh khách hàng khi trả lời không đổi. Trang Chatbot nội bộ (không truyền userId
            // nhưng có JWT) cũng đi nhánh này: server nhận ra người đăng nhập và tôn trọng newSession.
            { sessionId: newGuestId(), phone: null, displayName, newSession: true }
      );
      if (!isLatest()) return false;
      // Phiên mới thì lịch sử rỗng — tải lỗi cũng không sao.
      const history = await getChatbotMessages(started.sessionId, HISTORY_LIMIT).catch(() => []);
      if (!isLatest()) return false;
      if (!userId) rememberGuestSession(started.sessionId, true);
      applySession(started, history);
      return true;
    } catch (err) {
      if (!isLatest()) return false;
      console.error('[Chatbot] startNewSession failed', err);
      // Giữ nguyên phiên + tin nhắn đang có; chỉ báo lỗi.
      setError(NEW_SESSION_ERROR);
      return false;
    } finally {
      if (isLatest()) setReady(true);
    }
  }, [userId, phone, displayName, applySession]);

  const reconnect = useCallback(() => setBootNonce((n) => n + 1), []);

  const lastUserText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m.role === 'user' && m.content && m.content.trim()) return m.content;
    }
    return null;
  }, [messages]);

  return {
    ready,
    session,
    agent: session?.agent ?? null,
    tier: session?.tier ?? null,
    messages,
    typing,
    busy: typing,
    streamingMessageId,
    activity,
    connection,
    error,
    turnFailed,
    lastUserText,
    lastReplyAt,
    sendMessage,
    startNewSession,
    resetSession: startNewSession,
    reconnect,
  };
}
