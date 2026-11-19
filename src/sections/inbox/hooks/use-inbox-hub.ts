'use client';

import type { ConversationSummary, ConversationMessage } from 'src/lib/inbox';

import * as signalR from '@microsoft/signalr';
import { useRef, useState, useEffect } from 'react';

import { HOST_API } from 'src/config-global';

// ----------------------------------------------------------------------
// Hub /hubs/inbox (core-be, [Authorize(Roles = StoreStaff)]): gọi Join() để vào nhóm của cửa hàng (máy chủ chỉ nhận khi có
// conversation.read), rồi nhận:
//   - conversationUpdated(ConversationSummary) — tin mới, đổi người giữ, nhãn, trạng thái, đã đọc;
//   - messageAdded(ConversationMessage);
//   - messageUpdated(ConversationMessage)       — sending → sent / failed.
// Cách nối giống use-agent-board-hub: JWT qua accessTokenFactory, HOST_API rỗng trên production → cùng origin, ingress đưa
// /hubs thẳng tới core-api. Nối lại → Join lại + `onResync` để trang tải lại (có thể đã lỡ sự kiện). `live=false` → trang
// tự hỏi lại mỗi 30 giây.
// ----------------------------------------------------------------------

const HUB_PATH = '/hubs/inbox';

export type InboxHubState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

type Handlers = {
  onConversationUpdated?: (conversation: ConversationSummary) => void;
  onMessageAdded?: (message: ConversationMessage) => void;
  onMessageUpdated?: (message: ConversationMessage) => void;
  /** Vừa nối lại sau khi mất kết nối — tải lại dữ liệu. */
  onResync?: VoidFunction;
};

export function useInboxHub(handlers: Handlers, enabled = true) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const [state, setState] = useState<InboxHubState>('connecting');

  useEffect(() => {
    if (!enabled) return undefined;

    let stopped = false;
    let everJoined = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${HOST_API || ''}${HUB_PATH}`, {
        accessTokenFactory: () => sessionStorage.getItem('accessToken') ?? '',
      })
      .configureLogging(signalR.LogLevel.Warning)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 15000, 30000])
      .build();

    conn.on('conversationUpdated', (conversation: ConversationSummary) => {
      if (!stopped && conversation?.id) handlersRef.current.onConversationUpdated?.(conversation);
    });
    conn.on('messageAdded', (message: ConversationMessage) => {
      if (!stopped && message?.id) handlersRef.current.onMessageAdded?.(message);
    });
    conn.on('messageUpdated', (message: ConversationMessage) => {
      if (!stopped && message?.id) handlersRef.current.onMessageUpdated?.(message);
    });

    const join = async () => {
      if (stopped) return;
      try {
        // Máy chủ trả false (không ném lỗi) khi thiếu conversation.read → coi như không có trực tiếp.
        const joined = await conn.invoke<boolean>('Join');
        if (stopped) return;
        if (joined === false) {
          setState('disconnected');
          return;
        }
        setState('connected');
        if (everJoined) handlersRef.current.onResync?.();
        everJoined = true;
      } catch {
        if (!stopped) setState('disconnected');
      }
    };

    // Tự nối lại của SignalR có giới hạn — hết lượt thì thử lại thủ công, giãn dần tới 60 giây.
    const scheduleRetry = (delayMs: number) => {
      if (stopped) return;
      retryTimer = setTimeout(() => {
        if (stopped) return;
        setState('reconnecting');
        conn
          .start()
          .then(join)
          .catch(() => {
            if (stopped) return;
            setState('disconnected');
            scheduleRetry(Math.min(delayMs * 2, 60_000));
          });
      }, delayMs);
    };

    conn.onreconnecting(() => {
      if (!stopped) setState('reconnecting');
    });
    conn.onreconnected(() => {
      join();
    });
    conn.onclose(() => {
      if (stopped) return;
      setState('disconnected');
      scheduleRetry(5000);
    });

    setState('connecting');
    conn
      .start()
      .then(join)
      .catch(() => {
        if (stopped) return;
        setState('disconnected');
        scheduleRetry(5000);
      });

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      conn.stop().catch(() => {});
    };
  }, [enabled]);

  return { state, live: state === 'connected' };
}
