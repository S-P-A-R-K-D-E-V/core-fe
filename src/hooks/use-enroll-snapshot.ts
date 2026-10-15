'use client';

import * as signalR from '@microsoft/signalr';
import { useRef, useState, useEffect, useCallback } from 'react';

import { HOST_API } from 'src/config-global';

import type { BrowserPosition } from 'src/hooks/use-browser-location';
import type { IStoreLiveSnapshot } from 'src/types/attendance-live';

// ----------------------------------------------------------------------
// Chụp ảnh đăng ký khuôn mặt từ camera chấm công của chi nhánh qua /hubs/store-live:
// RequestSnapshot(deviceId, cameraKey) → agent trả ảnh độ phân giải cao cắt quanh khuôn mặt qua sự kiện "snapshot"
// (chỉ cho kết nối này, server không lưu). Mọi nhân viên dùng được với camera trong phạm vi chi nhánh của mình.

const HUB_PATH = '/hubs/store-live';
const SNAPSHOT_TIMEOUT_MS = 8_000;

export type EnrollSnapshotState = 'idle' | 'connecting' | 'ready' | 'error';

export type EnrollSnapshotResult = { data: string; error?: undefined } | { data?: undefined; error: string };

type Pending = { resolve: (r: EnrollSnapshotResult) => void; timer: ReturnType<typeof setTimeout> };

/** position: vị trí trình duyệt (người không phải Admin phải đang ở cửa hàng của camera); null = không gửi. */
export function useEnrollSnapshot(target: { deviceId: string; cameraKey: string } | null, position: BrowserPosition | null = null) {
  const connRef = useRef<signalR.HubConnection | null>(null);
  const positionRef = useRef<BrowserPosition | null>(position);
  positionRef.current = position;
  const pendingRef = useRef<Map<string, Pending>>(new Map());
  const [state, setState] = useState<EnrollSnapshotState>('idle');
  const [error, setError] = useState<string | null>(null);

  const deviceId = target?.deviceId ?? null;
  const cameraKey = target?.cameraKey ?? null;

  useEffect(() => {
    if (!deviceId || !cameraKey) {
      setState('idle');
      return undefined;
    }
    let stopped = false;
    const pending = pendingRef.current;
    setState('connecting');
    setError(null);

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${HOST_API || ''}${HUB_PATH}`, {
        accessTokenFactory: () => sessionStorage.getItem('accessToken') ?? '',
      })
      .configureLogging(signalR.LogLevel.Warning)
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .build();

    conn.on('snapshot', (snap: IStoreLiveSnapshot) => {
      const entry = snap?.requestId ? pending.get(snap.requestId) : undefined;
      if (!entry) return;
      clearTimeout(entry.timer);
      pending.delete(snap.requestId);
      entry.resolve(snap.data ? { data: snap.data } : { error: snap.error || 'Không chụp được ảnh từ camera quầy.' });
    });
    conn.onreconnecting(() => !stopped && setState('connecting'));
    conn.onreconnected(() => !stopped && setState('ready'));
    conn.onclose(() => {
      if (stopped) return;
      setState('error');
      setError('Mất kết nối máy chủ — thử lại.');
    });

    connRef.current = conn;
    conn
      .start()
      .then(() => !stopped && setState('ready'))
      .catch(() => {
        if (stopped) return;
        setState('error');
        setError('Không kết nối được máy chủ để dùng camera quầy.');
      });

    return () => {
      stopped = true;
      connRef.current = null;
      pending.forEach((p) => {
        clearTimeout(p.timer);
        p.resolve({ error: 'Đã đổi nguồn camera.' });
      });
      pending.clear();
      conn.stop().catch(() => {});
    };
  }, [deviceId, cameraKey]);

  /** Xin một ảnh (base64 JPEG, không tiền tố). Không bao giờ throw — lỗi trả về trong { error }. */
  const capture = useCallback(async (): Promise<EnrollSnapshotResult> => {
    const conn = connRef.current;
    if (!conn || conn.state !== signalR.HubConnectionState.Connected || !deviceId || !cameraKey) {
      return { error: 'Đang kết nối camera quầy…' };
    }
    try {
      const p = positionRef.current;
      const res = await conn.invoke<{ ok: boolean; error?: string | null; requestId?: string | null }>(
        'RequestSnapshot',
        deviceId,
        cameraKey,
        p?.latitude ?? null,
        p?.longitude ?? null,
        p?.accuracy ?? null
      );
      if (!res?.ok || !res.requestId) return { error: res?.error || 'Không chụp được ảnh từ camera quầy.' };
      const { requestId } = res;
      return await new Promise<EnrollSnapshotResult>((resolve) => {
        const timer = setTimeout(() => {
          pendingRef.current.delete(requestId);
          resolve({ error: 'Camera quầy không phản hồi — kiểm tra máy tính ở quầy.' });
        }, SNAPSHOT_TIMEOUT_MS);
        pendingRef.current.set(requestId, { resolve, timer });
      });
    } catch {
      return { error: 'Không gửi được yêu cầu chụp ảnh.' };
    }
  }, [deviceId, cameraKey]);

  return { state, error, capture };
}
