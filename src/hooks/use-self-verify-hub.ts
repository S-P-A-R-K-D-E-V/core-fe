'use client';

import * as signalR from '@microsoft/signalr';
import { useCallback, useEffect, useRef, useState } from 'react';

import { HOST_API } from 'src/config-global';

import type { IKioskTrack, IKioskTracksMessage, KioskConnectionState } from 'src/types/kiosk';

// ----------------------------------------------------------------------
// Live camera "tự kiểm tra khuôn mặt" — mirror useKioskHub (đã hardening kỹ qua nhiều vòng debug
// thực tế: auto-reconnect 2 lớp, error/tracks parsing) nhưng auth qua JWT thường (accessTokenFactory,
// giống messenger-provider.tsx) thay vì kiosk device key, và nhận "verify_result" (so khớp 1:1 với
// ĐÚNG người đang đăng nhập) thay vì "candidate_found" (nhận diện 1:N). Không có debug-log popup
// riêng như kiosk — đây là trang web thường, người dùng có DevTools, không cần thiết bị kiosk hoá.

export type IVerifyResult = { trackId: string; matched: boolean; similarity: number };

function parseTracksMessage(raw: string): IKioskTrack[] {
  try {
    const parsed = JSON.parse(raw) as IKioskTracksMessage;
    return Array.isArray(parsed?.tracks) ? parsed.tracks : [];
  } catch {
    return [];
  }
}

function parseErrorMessage(raw: unknown): string {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed?.message ?? raw;
    } catch {
      return raw;
    }
  }
  if (raw && typeof raw === 'object' && 'message' in raw) {
    return String((raw as { message?: unknown }).message ?? 'Lỗi không xác định');
  }
  return 'Lỗi không xác định';
}

/** @param active Chỉ mở kết nối khi true (dialog đang mở) — tắt hẳn kết nối khi đóng dialog thay
 *  vì giữ ngầm, vì đây là tính năng phụ trợ dùng ngắn hạn, không phải kiosk chạy 24/7. */
export function useSelfVerifyHub(active: boolean) {
  const connRef = useRef<signalR.HubConnection | null>(null);
  const seqRef = useRef(0);

  const [connectionState, setConnectionState] = useState<KioskConnectionState>('connecting');
  const [tracks, setTracks] = useState<IKioskTrack[]>([]);
  const [verifyResult, setVerifyResult] = useState<IVerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    if (!active) return undefined;

    setConnectionState('connecting');
    setTracks([]);
    setVerifyResult(null);
    setError(null);
    seqRef.current = 0;

    let stoppedIntentionally = false;
    let manualRetryTimer: ReturnType<typeof setTimeout> | null = null;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${HOST_API || ''}/hubs/self-verify`, {
        accessTokenFactory: () => sessionStorage.getItem('accessToken') ?? '',
      })
      .configureLogging(signalR.LogLevel.Warning)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 15000, 30000])
      .build();

    conn.on('tracks', (raw: string) => setTracks(parseTracksMessage(raw)));
    conn.on('verify_result', (payload: IVerifyResult) => setVerifyResult(payload));
    conn.on('error', (raw: unknown) => setError(parseErrorMessage(raw)));

    conn.onreconnecting(() => setConnectionState('reconnecting'));
    conn.onreconnected(() => setConnectionState('connected'));

    // Retry thủ công không giới hạn khi automatic reconnect bỏ cuộc — cùng lý do đã áp dụng ở
    // useKioskHub (SignalR mặc định KHÔNG tự nối lại vô hạn, WS rớt ngắn hạn trên mạng di
    // động/wifi rất phổ biến). Dialog này ngắn hạn (người dùng tự đóng khi xong) nên không cần
    // backoff dài như kiosk 24/7, nhưng vẫn cần retry để không "chết cứng" giữa chừng.
    function scheduleManualRetry(delayMs: number) {
      if (stoppedIntentionally) return;
      manualRetryTimer = setTimeout(() => {
        if (stoppedIntentionally) return;
        setConnectionState('reconnecting');
        conn
          .start()
          .then(() => {
            connRef.current = conn;
            setConnectionState('connected');
          })
          .catch(() => scheduleManualRetry(Math.min(delayMs * 2, 15000)));
      }, delayMs);
    }

    conn.onclose(() => {
      setConnectionState('disconnected');
      scheduleManualRetry(2000);
    });

    conn
      .start()
      .then(() => {
        connRef.current = conn;
        setConnectionState('connected');
      })
      .catch((err) => {
        setConnectionState('disconnected');
        setError(String(err?.message ?? err ?? 'Không kết nối được máy chủ'));
        scheduleManualRetry(2000);
      });

    return () => {
      stoppedIntentionally = true;
      if (manualRetryTimer) clearTimeout(manualRetryTimer);
      conn.stop().catch(() => {});
      connRef.current = null;
    };
  }, [active]);

  const sendFrame = useCallback((base64Data: string) => {
    const conn = connRef.current;
    if (conn?.state !== signalR.HubConnectionState.Connected) return;
    seqRef.current += 1;
    conn.invoke('Frame', seqRef.current, base64Data).catch(() => {});
  }, []);

  return { connectionState, tracks, verifyResult, error, clearError, sendFrame };
}
