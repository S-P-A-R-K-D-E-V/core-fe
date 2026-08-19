'use client';

import * as signalR from '@microsoft/signalr';
import { useCallback, useEffect, useRef, useState } from 'react';

import { HOST_API } from 'src/config-global';

import type {
  IKioskCandidateFound,
  IKioskTrack,
  IKioskTracksMessage,
  KioskConnectionState,
} from 'src/types/kiosk';

// Mirror pattern của src/components/messenger/messenger-provider.tsx (SignalR connection
// lifecycle) — khác biệt: kiosk auth qua query string `kioskKey` (KioskAuthenticationHandler.
// QueryParamName phía Core-be), KHÔNG dùng accessTokenFactory (đó là cho JWT Bearer).
//
// Không còn `?mode=` — kiosk không gạt tay chọn check-in/check-out nữa, BE tự suy luận theo
// từng candidate (xem IKioskCandidateFound.isCheckIn).

// "tracks" Core-be forward NGUYÊN VĂN dạng string JSON (không phải object đã parse) —
// xem KioskStreamSession.HandleTracksAsync: `_caller.SendAsync("tracks", rawJson)`.
function parseTracksMessage(raw: string): IKioskTrack[] {
  try {
    const parsed = JSON.parse(raw) as IKioskTracksMessage;
    return Array.isArray(parsed?.tracks) ? parsed.tracks : [];
  } catch {
    return [];
  }
}

// "error" event có 2 dạng: object { message } (lỗi Core-be tự tạo) hoặc string JSON thô
// forward nguyên từ upstream face-tracking-service — xử lý cả 2.
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

export function useKioskHub(deviceKey: string | null) {
  const connRef = useRef<signalR.HubConnection | null>(null);
  const seqRef = useRef(0);

  const [connectionState, setConnectionState] = useState<KioskConnectionState>('connecting');
  const [tracks, setTracks] = useState<IKioskTrack[]>([]);
  const [candidate, setCandidate] = useState<IKioskCandidateFound | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearCandidate = useCallback(() => setCandidate(null), []);
  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    if (!deviceKey) return undefined;

    setConnectionState('connecting');
    setTracks([]);
    setCandidate(null);
    setError(null);
    seqRef.current = 0;

    const url = `${HOST_API || ''}/hubs/kiosk?kioskKey=${encodeURIComponent(deviceKey)}`;
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(url)
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    conn.on('tracks', (raw: string) => setTracks(parseTracksMessage(raw)));
    conn.on('candidate_found', (payload: IKioskCandidateFound) => setCandidate(payload));
    conn.on('error', (raw: unknown) => setError(parseErrorMessage(raw)));

    conn.onreconnecting(() => setConnectionState('reconnecting'));
    conn.onreconnected(() => setConnectionState('connected'));
    conn.onclose(() => setConnectionState('disconnected'));

    conn
      .start()
      .then(() => {
        connRef.current = conn;
        setConnectionState('connected');
      })
      .catch((err) => {
        console.error('[useKioskHub] connect failed', err);
        setConnectionState('disconnected');
        const message = String(err?.message ?? err ?? '');
        // Khoá thiết bị sai/đã bị thu hồi → BE trả 401 ngay lúc negotiate, KHÁC lỗi mạng thật sự
        // (timeout, DNS...). Phân biệt rõ để người dùng biết cần "Đổi thiết bị" chứ không phải
        // chờ mạng ổn định lại (xem KioskAuthenticationHandler).
        setError(
          /401|unauthorized/i.test(message)
            ? 'Khoá thiết bị không hợp lệ hoặc đã bị thu hồi — bấm "Đổi thiết bị" để ghép nối lại.'
            : 'Không kết nối được máy chủ'
        );
      });

    return () => {
      conn.stop().catch(() => {});
      connRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceKey]);

  const sendFrame = useCallback((base64Data: string) => {
    const conn = connRef.current;
    if (conn?.state !== signalR.HubConnectionState.Connected) return;
    seqRef.current += 1;
    conn.invoke('Frame', seqRef.current, base64Data).catch(() => {});
  }, []);

  return { connectionState, tracks, candidate, error, clearCandidate, clearError, sendFrame };
}
