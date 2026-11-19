import type {
  QuickReply,
  MessagePage,
  InboxSummary,
  CustomerPanel,
  QuickReplyInput,
  TestInboundInput,
  ConversationPage,
  SendMessageInput,
  ConversationDetail,
  CustomerUpdateInput,
  ConversationStatus,
  ConversationSummary,
  ConversationMessage,
  ConversationSettings,
  ConversationListFilter,
} from 'src/lib/inbox';

import useSWR from 'swr';
import { useMemo } from 'react';
import useSWRInfinite from 'swr/infinite';

import axios, { fetcher } from 'src/utils/axios';

import { conversationListQuery } from 'src/lib/inbox';

// ----------------------------------------------------------------------
// Hộp thư khách (F2, core-be /conversations/*, /conversation-quick-replies, /conversation-settings).
// Hợp đồng: docs/cici/plans/fb-inbox-api-contract.md. Cập nhật trực tiếp qua hub /hubs/inbox
// (src/sections/inbox/hooks/use-inbox-hub.ts) — màn hình ghi thẳng vào cache SWR bằng các khoá dưới đây.
// ----------------------------------------------------------------------

const ROOT = '/conversations';
const QUICK = '/conversation-quick-replies';
const SETTINGS = '/conversation-settings';

export const INBOX_PAGE_SIZE = 30;
export const MESSAGE_PAGE_SIZE = 50;
/** Hub mất kết nối → hỏi lại định kỳ. */
const POLL_MS = 30_000;

export const inboxSummaryKey = `${ROOT}/summary`;
export const conversationDetailKey = (id: string) => `${ROOT}/${id}`;
export const quickRepliesKey = QUICK;
export const conversationSettingsKey = SETTINGS;
export const testChannelKey = `${ROOT}/test-channel`;

function messagesUrl(id: string, before: string | null) {
  const params = new URLSearchParams();
  if (before) params.set('before', before);
  params.set('take', String(MESSAGE_PAGE_SIZE));
  return `${ROOT}/${id}/messages?${params.toString()}`;
}

// ----------------------------------------------------------------------
// Đọc.

export function useInboxSummary(options?: { enabled?: boolean; poll?: boolean }) {
  const enabled = options?.enabled ?? true;
  const { data, isLoading, error, mutate } = useSWR<InboxSummary>(enabled ? inboxSummaryKey : null, fetcher, {
    refreshInterval: options?.poll ? POLL_MS : 0,
    keepPreviousData: true,
    shouldRetryOnError: false,
  });
  return useMemo(
    () => ({ summary: data, loading: isLoading && !data, error, refresh: mutate }),
    [data, isLoading, error, mutate]
  );
}

/** Danh sách hội thoại theo trang ("Tải thêm" theo `nextBefore`). `mutate` gắn sẵn để hub ghi thẳng vào. */
export function useConversationList(filter: ConversationListFilter, poll = false, enabled = true) {
  const getKey = (index: number, previous: ConversationPage | null) => {
    if (!enabled) return null;
    if (index > 0 && !previous?.nextBefore) return null;
    return `${ROOT}?${conversationListQuery(filter, index > 0 ? previous?.nextBefore : null, INBOX_PAGE_SIZE)}`;
  };
  const { data, size, setSize, isLoading, isValidating, error, mutate } = useSWRInfinite<ConversationPage>(
    getKey,
    fetcher,
    { refreshInterval: poll ? POLL_MS : 0, revalidateFirstPage: true, keepPreviousData: true }
  );

  return useMemo(() => {
    const seen = new Set<string>();
    const items: ConversationSummary[] = [];
    (data ?? []).forEach((page) =>
      page.items.forEach((c) => {
        if (seen.has(c.id)) return;
        seen.add(c.id);
        items.push(c);
      })
    );
    const last = data?.[data.length - 1];
    return {
      pages: data,
      items,
      hasMore: !!last?.nextBefore,
      loading: enabled && isLoading && !data,
      loadingMore: isValidating && !!data && size > data.length,
      loadMore: () => setSize(size + 1),
      error,
      mutate,
    };
  }, [data, size, setSize, isLoading, isValidating, error, mutate, enabled]);
}

export function useConversationDetail(id: string | null, poll = false) {
  const { data, isLoading, error, mutate } = useSWR<ConversationDetail>(id ? conversationDetailKey(id) : null, fetcher, {
    refreshInterval: poll ? POLL_MS : 0,
    keepPreviousData: false,
  });
  return useMemo(
    () => ({ detail: data, loading: !!id && isLoading && !data, error, refresh: mutate }),
    [data, id, isLoading, error, mutate]
  );
}

/** Tin nhắn: trang 0 = mới nhất, trang sau = cũ hơn ("Xem tin cũ hơn"). */
export function useConversationMessages(id: string | null, poll = false) {
  const getKey = (index: number, previous: MessagePage | null) => {
    if (!id) return null;
    if (index > 0 && !previous?.nextBefore) return null;
    return messagesUrl(id, index > 0 ? previous?.nextBefore ?? null : null);
  };
  const { data, size, setSize, isLoading, isValidating, error, mutate } = useSWRInfinite<MessagePage>(getKey, fetcher, {
    refreshInterval: poll ? POLL_MS : 0,
    revalidateFirstPage: true,
    revalidateOnFocus: false,
  });
  return useMemo(() => {
    const last = data?.[data.length - 1];
    return {
      pages: data,
      hasOlder: !!last?.nextBefore,
      loading: !!id && isLoading && !data,
      loadingOlder: isValidating && !!data && size > data.length,
      loadOlder: () => setSize(size + 1),
      error,
      mutate,
    };
  }, [data, id, size, setSize, isLoading, isValidating, error, mutate]);
}

export function useQuickReplies(enabled = true) {
  const { data, isLoading, error, mutate } = useSWR<QuickReply[]>(enabled ? quickRepliesKey : null, fetcher, {
    revalidateOnFocus: false,
  });
  return useMemo(
    () => ({ replies: data ?? [], loading: isLoading && !data, error, refresh: mutate }),
    [data, isLoading, error, mutate]
  );
}

export function useConversationSettings(enabled = true) {
  const { data, isLoading, error, mutate } = useSWR<ConversationSettings>(
    enabled ? conversationSettingsKey : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  return useMemo(
    () => ({ settings: data, loading: isLoading && !data, error, refresh: mutate }),
    [data, isLoading, error, mutate]
  );
}

/** Kênh thử của cửa hàng (máy chủ tự tạo nếu chưa có). */
export function useTestChannel(enabled = true) {
  const { data, isLoading, error } = useSWR<{ channelId: string }>(enabled ? testChannelKey : null, fetcher, {
    revalidateOnFocus: false,
  });
  return useMemo(
    () => ({ channelId: data?.channelId ?? null, loading: isLoading && !data, error }),
    [data, isLoading, error]
  );
}

// ----------------------------------------------------------------------
// Ghi.

/** Gửi tin / ghi chú nội bộ. Lỗi phía Facebook vẫn trả tin `status: 'failed'` (không ném). */
export async function sendConversationMessage(id: string, input: SendMessageInput) {
  return (await axios.post<ConversationMessage>(`${ROOT}/${id}/messages`, input)).data;
}

/** Hội thoại bình luận: ẩn / hiện lại một bình luận của khách trên Facebook. */
export async function setCommentHidden(id: string, messageId: string, hidden: boolean) {
  return (await axios.post<ConversationMessage>(`${ROOT}/${id}/messages/${messageId}/hide`, { hidden })).data;
}

/**
 * Hội thoại bình luận: nhắn riêng Messenger cho người bình luận (1 tin / bình luận, trong 7 ngày).
 * Facebook từ chối → 409 `Conversation.PrivateReplyFailed` (detail tiếng Việt).
 */
export async function sendPrivateReply(id: string, text: string) {
  return (await axios.post<ConversationMessage>(`${ROOT}/${id}/private-reply`, { text })).data;
}

/** Giành quyền trả lời; `force` (quyền manage) để giành từ nhân viên khác. */
export async function takeConversation(id: string, force = false) {
  return (await axios.post<ConversationSummary>(`${ROOT}/${id}/take`, force ? { force: true } : {})).data;
}

export async function releaseConversation(id: string, to: 'agent' | 'none') {
  return (await axios.post<ConversationSummary>(`${ROOT}/${id}/release`, { to })).data;
}

export async function assignConversation(id: string, userId: string | null) {
  return (await axios.post<ConversationSummary>(`${ROOT}/${id}/assign`, { userId })).data;
}

export async function markConversationRead(id: string) {
  await axios.post(`${ROOT}/${id}/read`);
}

/** Đánh dấu chưa đọc (unread = 1 nếu đang 0) → ConversationSummary. */
export async function markConversationUnread(id: string) {
  return (await axios.post<ConversationSummary>(`${ROOT}/${id}/unread`)).data;
}

export async function setConversationTags(id: string, tags: string[]) {
  return (await axios.put<ConversationSummary>(`${ROOT}/${id}/tags`, { tags })).data;
}

export async function setConversationStatus(id: string, status: ConversationStatus) {
  return (await axios.post<ConversationSummary>(`${ROOT}/${id}/status`, { status })).data;
}

export async function updateConversationCustomer(id: string, input: CustomerUpdateInput) {
  return (await axios.put<CustomerPanel>(`${ROOT}/${id}/customer`, input)).data;
}

/** Ảnh gửi khách: xin URL ký sẵn rồi PUT thẳng lên R2 công khai (như ảnh bài đăng). JPEG / PNG. */
export async function uploadConversationImage(file: File): Promise<string> {
  const { data } = await axios.post<{ uploadUrl: string; publicUrl: string }>(`${ROOT}/images`, {
    fileName: file.name,
    contentType: file.type,
  });
  const res = await fetch(data.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
  if (!res.ok) throw new Error('Tải ảnh lên thất bại');
  return data.publicUrl;
}

/** Kênh thử: nhân viên đóng vai khách gửi tin vào hộp thư. */
export async function sendTestInbound(input: TestInboundInput) {
  return (await axios.post<ConversationSummary>(`${ROOT}/test-channel/inbound`, input)).data;
}

export async function createQuickReply(input: QuickReplyInput) {
  return (await axios.post<QuickReply>(QUICK, input)).data;
}

export async function updateQuickReply(id: string, input: QuickReplyInput) {
  return (await axios.put<QuickReply>(`${QUICK}/${id}`, input)).data;
}

export async function deleteQuickReply(id: string) {
  await axios.delete(`${QUICK}/${id}`);
}

export async function saveConversationSettings(input: ConversationSettings) {
  return (await axios.put<ConversationSettings>(SETTINGS, input)).data;
}
