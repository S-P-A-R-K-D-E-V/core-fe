'use client';

import type { IAgentTask, IAgentRunStep, IAgentCenterSummary } from 'src/api/agent-center';

import * as signalR from '@microsoft/signalr';
import { useRef, useState, useEffect } from 'react';

import { HOST_API } from 'src/config-global';

// ----------------------------------------------------------------------
// Hub /hubs/agent-board (core-be, [Authorize(Roles = StoreStaff)]): gọi Join() để vào nhóm của cửa hàng (máy chủ chỉ
// nhận khi có agent.approve), rồi nhận:
//   - taskUpdated(AgentTask)   — trạng thái / kế hoạch / bước hiện tại / token đổi;
//   - stepAdded(AgentRunStep)  — bước mới của một việc (kèm taskId);
//   - summaryChanged(summary)  — như GET agent-center/summary.
// JWT qua accessTokenFactory, HOST_API rỗng trên production → cùng origin, ingress đưa /hubs thẳng tới core-api (giống
// use-store-live-hub). Nối lại: máy chủ quên nhóm → Join lại, và báo `onResync` để trang tải lại (có thể đã lỡ sự kiện).
// `live=false` (chưa nối / đang nối lại / hỏng) → trang tự hỏi lại mỗi 30 giây.
// ----------------------------------------------------------------------

const HUB_PATH = '/hubs/agent-board';

export type AgentBoardConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

type Handlers = {
  onTaskUpdated?: (task: IAgentTask) => void;
  onStepAdded?: (step: IAgentRunStep) => void;
  onSummaryChanged?: (summary: IAgentCenterSummary) => void;
  /** Vừa nối lại sau khi mất kết nối — tải lại dữ liệu. */
  onResync?: VoidFunction;
};

export function useAgentBoardHub(handlers: Handlers, enabled = true) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const [state, setState] = useState<AgentBoardConnectionState>('connecting');

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

    conn.on('taskUpdated', (task: IAgentTask) => {
      if (!stopped && task?.id) handlersRef.current.onTaskUpdated?.(task);
    });
    conn.on('stepAdded', (step: IAgentRunStep) => {
      if (!stopped && step?.taskId) handlersRef.current.onStepAdded?.(step);
    });
    conn.on('summaryChanged', (summary: IAgentCenterSummary) => {
      if (!stopped && summary) handlersRef.current.onSummaryChanged?.(summary);
    });

    const join = async () => {
      if (stopped) return;
      try {
        // Máy chủ trả false (không ném lỗi) khi người dùng thiếu agent.approve → coi như không có trực tiếp.
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
        // Join bị từ chối (thiếu quyền / hub chưa có) → coi như không có trực tiếp, trang hỏi lại định kỳ.
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
