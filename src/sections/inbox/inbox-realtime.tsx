'use client';

import type { ConversationSummary, ConversationMessage } from 'src/lib/inbox';

import { useSWRConfig } from 'swr';
import { useRef, useMemo, useEffect, useContext, useCallback, createContext } from 'react';

import { mergeDetail } from 'src/lib/inbox';
import { inboxSummaryKey, conversationDetailKey } from 'src/api/inbox';

import { useInboxHub } from './hooks/use-inbox-hub';

// ----------------------------------------------------------------------
// Một kết nối hub /hubs/inbox cho cả trang; danh sách và khung hội thoại đăng ký nghe qua `useInboxEvents`.
// Kết quả trả về của lệnh ghi (take / release / assign / tags / status / test inbound) đi qua `applyConversation` để cập nhật
// giống hệt sự kiện hub (hub có thể về trễ hoặc không về khi mất kết nối).
// Ở đây xử lý phần chung: chi tiết hội thoại (ghi đè trường tóm tắt) và số đếm theo tab (hỏi lại, gom 800 ms).
// ----------------------------------------------------------------------

export type InboxListener = {
  onConversationUpdated?: (conversation: ConversationSummary) => void;
  onMessageAdded?: (message: ConversationMessage) => void;
  onMessageUpdated?: (message: ConversationMessage) => void;
  onResync?: VoidFunction;
};

type ContextValue = {
  live: boolean;
  subscribe: (listener: { current: InboxListener }) => VoidFunction;
  applyConversation: (conversation: ConversationSummary) => void;
  applyMessage: (message: ConversationMessage) => void;
};

const InboxRealtimeContext = createContext<ContextValue | null>(null);

type Props = {
  children: React.ReactNode;
  /** false = không nối hub (thiếu quyền). */
  enabled?: boolean;
};

export function InboxRealtimeProvider({ children, enabled = true }: Props) {
  const { mutate } = useSWRConfig();
  const listeners = useRef(new Set<{ current: InboxListener }>());
  const summaryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (summaryTimer.current) clearTimeout(summaryTimer.current);
    },
    []
  );

  const refreshSummarySoon = useCallback(() => {
    if (summaryTimer.current) clearTimeout(summaryTimer.current);
    summaryTimer.current = setTimeout(() => {
      summaryTimer.current = null;
      mutate(inboxSummaryKey);
    }, 800);
  }, [mutate]);

  const applyConversation = useCallback(
    (conversation: ConversationSummary) => {
      mutate(conversationDetailKey(conversation.id), (detail: any) => mergeDetail(detail, conversation), {
        revalidate: false,
        populateCache: (result: any, current: any) => result ?? current,
      });
      listeners.current.forEach((l) => l.current.onConversationUpdated?.(conversation));
      refreshSummarySoon();
    },
    [mutate, refreshSummarySoon]
  );

  const applyMessage = useCallback((message: ConversationMessage) => {
    listeners.current.forEach((l) => l.current.onMessageAdded?.(message));
  }, []);

  const hub = useInboxHub(
    {
      onConversationUpdated: applyConversation,
      onMessageAdded: applyMessage,
      onMessageUpdated: (message) => listeners.current.forEach((l) => l.current.onMessageUpdated?.(message)),
      onResync: () => {
        mutate(inboxSummaryKey);
        listeners.current.forEach((l) => l.current.onResync?.());
      },
    },
    enabled
  );

  const subscribe = useCallback((listener: { current: InboxListener }) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo(
    () => ({ live: hub.live, subscribe, applyConversation, applyMessage }),
    [hub.live, subscribe, applyConversation, applyMessage]
  );

  return <InboxRealtimeContext.Provider value={value}>{children}</InboxRealtimeContext.Provider>;
}

const NOOP_CONTEXT: ContextValue = {
  live: false,
  subscribe: () => () => {},
  applyConversation: () => {},
  applyMessage: () => {},
};

export function useInboxRealtime(): ContextValue {
  return useContext(InboxRealtimeContext) ?? NOOP_CONTEXT;
}

/** Nghe sự kiện hộp thư (handler luôn là bản mới nhất, không cần useCallback). */
export function useInboxEvents(listener: InboxListener) {
  const { subscribe } = useInboxRealtime();
  const ref = useRef(listener);
  ref.current = listener;
  useEffect(() => subscribe(ref), [subscribe]);
}
