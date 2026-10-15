'use client';

import * as signalR from '@microsoft/signalr';
import { useRef, useState, useEffect, useCallback } from 'react';

import { HOST_API } from 'src/config-global';

import type {
  ILiveOverlayBox,
  IStoreLiveFrame,
  IStoreLiveStatus,
  IStoreLiveWatchResult,
  IStorePresenceChanged,
  IStoreLiveInvokeResult,
  StoreLiveConnectionState,
} from 'src/types/attendance-live';

// ----------------------------------------------------------------------
// Hub /hubs/store-live cho trang Chấm công trực tiếp (JWT qua accessTokenFactory, giống messenger-provider):
//   - WatchBranch(branchId): nhận "presence_changed" khi camera của chi nhánh nhận ra ai đó;
//   - Watch(deviceId) / Unwatch(deviceId): bật/tắt luồng hình "live_frame" (tối đa 8 hình/giây mỗi camera) của một agent.
//     Máy chủ ngừng luồng khi không còn ai xem, nên luôn Unwatch khi tạm dừng, đổi chi nhánh hay rời trang.
// Mỗi chi nhánh một kết nối: hub không có UnwatchBranch, đổi chi nhánh = đóng kết nối cũ (Unwatch trước) rồi mở
// kết nối mới, nên không còn nhận sự kiện của chi nhánh trước. Nối lại (tự động hoặc thủ công) → máy chủ đã quên
// các đăng ký → gọi lại WatchBranch + Watch.

const HUB_PATH = '/hubs/store-live';

export const frameKey = (deviceId: string, cameraKey: string) => `${deviceId}|${cameraKey}`;

export type LiveFrameState = {
  /** JPEG base64, không có tiền tố data:. */
  data: string;
  /** Thời điểm agent chụp (ISO, từ máy chủ). */
  at: string;
  /** Lúc trình duyệt nhận (ms) — dùng để biết hình còn "LIVE" không, tránh lệch giờ giữa máy chủ và máy xem. */
  receivedAt: number;
  /** Khung nhận diện kèm hình (agent ≥ 0.5, camera quầy); null = không có. */
  overlay: ILiveOverlayBox[] | null;
  /** Số hình/giây trình duyệt đang nhận thực tế (trung bình ~12 hình gần nhất); null khi chưa đủ mẫu. */
  fps: number | null;
};

const FPS_SAMPLES = 12;

/** Hình/giây từ các mốc nhận gần nhất (ms). */
export function receivedFps(times: number[]): number | null {
  if (times.length < 3) return null;
  const span = times[times.length - 1] - times[0];
  return span > 0 ? ((times.length - 1) * 1000) / span : null;
}

export type UseStoreLiveHubOptions = {
  /** null/'' = chưa chọn chi nhánh → không mở kết nối. */
  branchId: string | null;
  /** Thiết bị cần xem hình trực tiếp (thứ tự/lặp không quan trọng). */
  deviceIds: string[];
  /** Tạm dừng xem: Unwatch mọi thiết bị, vẫn giữ WatchBranch để nhận presence. */
  paused: boolean;
  /** Không cần ổn định identity — hook giữ bản mới nhất trong ref. */
  onPresence?: (event: IStorePresenceChanged) => void;
};

export type UseStoreLiveHubResult = {
  connectionState: StoreLiveConnectionState;
  /** Hình mới nhất theo frameKey(deviceId, cameraKey). */
  frames: Record<string, LiveFrameState>;
  /** Agent của thiết bị có đang nối vào hub không (từ kết quả Watch và sự kiện live_status). */
  sources: Record<string, boolean>;
  error: string | null;
};

function errorText(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message?: unknown }).message ?? '').trim();
    if (msg) return msg;
  }
  return fallback;
}

export function useStoreLiveHub({ branchId, deviceIds, paused, onPresence }: UseStoreLiveHubOptions): UseStoreLiveHubResult {
  const connRef = useRef<signalR.HubConnection | null>(null);
  /** Thiết bị đã Watch trên kết nối hiện tại. */
  const watchedRef = useRef<Set<string>>(new Set());
  /** Thiết bị muốn xem lúc này ([] khi tạm dừng). */
  const desiredRef = useRef<string[]>([]);
  /** Tăng mỗi khi mở kết nối mới — bỏ qua kết quả invoke trễ của kết nối cũ. */
  const generationRef = useRef(0);
  /** Mốc nhận hình gần nhất theo frameKey — để tính hình/giây. */
  const arrivalsRef = useRef<Map<string, number[]>>(new Map());
  const onPresenceRef = useRef(onPresence);

  const [connectionState, setConnectionState] = useState<StoreLiveConnectionState>('idle');
  const [frames, setFrames] = useState<Record<string, LiveFrameState>>({});
  const [sources, setSources] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onPresenceRef.current = onPresence;
  }, [onPresence]);

  // Khoá chuỗi để mảng deviceIds mới (mỗi lần tải lại bảng) không làm Watch/Unwatch lại.
  const deviceKey = paused ? '' : Array.from(new Set(deviceIds.filter(Boolean))).sort().join(',');

  /** Đưa tập Watch trên máy chủ về đúng desiredRef: Unwatch thừa, Watch thiếu. */
  const syncWatches = useCallback(() => {
    const conn = connRef.current;
    if (!conn || conn.state !== signalR.HubConnectionState.Connected) return;
    const generation = generationRef.current;
    const desired = new Set(desiredRef.current);
    const watched = watchedRef.current;

    Array.from(watched).forEach((id) => {
      if (desired.has(id)) return;
      watched.delete(id);
      conn.invoke('Unwatch', id).catch(() => {});
    });

    desired.forEach((id) => {
      if (watched.has(id)) return;
      watched.add(id);
      conn
        .invoke<IStoreLiveWatchResult>('Watch', id)
        .then((res) => {
          if (generationRef.current !== generation) return;
          if (!res?.ok) {
            watched.delete(id);
            setError(res?.error || 'Không mở được hình trực tiếp của thiết bị.');
            return;
          }
          const connected = !!res.sourceConnected;
          setSources((prev) => (prev[id] === connected ? prev : { ...prev, [id]: connected }));
        })
        .catch((err) => {
          if (generationRef.current !== generation) return;
          watched.delete(id);
          setError(errorText(err, 'Không mở được hình trực tiếp của thiết bị.'));
        });
    });
  }, []);

  // Kết nối theo chi nhánh.
  useEffect(() => {
    if (!branchId) {
      setConnectionState('idle');
      return undefined;
    }

    generationRef.current += 1;
    watchedRef.current = new Set();
    setFrames({});
    setSources({});
    setError(null);
    setConnectionState('connecting');

    let stopped = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const conn = new signalR.HubConnectionBuilder()
      // HOST_API rỗng trên production → URL tương đối cùng origin qua ingress.
      .withUrl(`${HOST_API || ''}${HUB_PATH}`, {
        accessTokenFactory: () => sessionStorage.getItem('accessToken') ?? '',
      })
      .configureLogging(signalR.LogLevel.Warning)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 15000, 30000])
      .build();

    conn.on('live_frame', (frame: IStoreLiveFrame) => {
      if (stopped || !frame?.deviceId || !frame.cameraKey || typeof frame.data !== 'string') return;
      // Hình còn bay tới sau khi Unwatch (tạm dừng) thì bỏ.
      if (!watchedRef.current.has(frame.deviceId)) return;
      const key = frameKey(frame.deviceId, frame.cameraKey);
      const receivedAt = Date.now();
      const times = [...(arrivalsRef.current.get(key) ?? []), receivedAt].slice(-FPS_SAMPLES);
      arrivalsRef.current.set(key, times);
      setFrames((prev) => ({
        ...prev,
        [key]: { data: frame.data, at: frame.at, receivedAt, overlay: frame.overlay ?? null, fps: receivedFps(times) },
      }));
    });

    conn.on('live_status', (status: IStoreLiveStatus) => {
      if (stopped || !status?.deviceId) return;
      const connected = !!status.sourceConnected;
      setSources((prev) => (prev[status.deviceId] === connected ? prev : { ...prev, [status.deviceId]: connected }));
    });

    conn.on('presence_changed', (event: IStorePresenceChanged) => {
      if (stopped || !event) return;
      if (event.branchId && event.branchId !== branchId) return;
      onPresenceRef.current?.(event);
    });

    /** Sau khi (nối lại) thành công: máy chủ không nhớ đăng ký cũ → đăng ký lại từ đầu. */
    const subscribe = async () => {
      if (stopped) return;
      watchedRef.current = new Set();
      connRef.current = conn;
      setError(null);
      setConnectionState('connected');
      syncWatches();
      try {
        const res = await conn.invoke<IStoreLiveInvokeResult>('WatchBranch', branchId);
        if (!stopped && res && res.ok === false) setError(res.error || 'Không theo dõi được chi nhánh này.');
      } catch (err) {
        if (!stopped) setError(errorText(err, 'Không theo dõi được chi nhánh này.'));
      }
    };

    // Tự nối lại của SignalR có giới hạn số lần — hết lượt thì thử lại thủ công, giãn dần tới 30 giây.
    const scheduleRetry = (delayMs: number) => {
      if (stopped) return;
      retryTimer = setTimeout(() => {
        if (stopped) return;
        setConnectionState('reconnecting');
        conn
          .start()
          .then(subscribe)
          .catch(() => scheduleRetry(Math.min(delayMs * 2, 30_000)));
      }, delayMs);
    };

    conn.onreconnecting(() => {
      if (!stopped) setConnectionState('reconnecting');
    });
    conn.onreconnected(() => {
      subscribe();
    });
    conn.onclose(() => {
      if (stopped) return;
      setConnectionState('disconnected');
      scheduleRetry(2000);
    });

    conn
      .start()
      .then(subscribe)
      .catch((err) => {
        if (stopped) return;
        setConnectionState('disconnected');
        setError(errorText(err, 'Không kết nối được máy chủ xem trực tiếp.'));
        scheduleRetry(2000);
      });

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (connRef.current === conn) connRef.current = null;
      const watched = Array.from(watchedRef.current);
      watchedRef.current = new Set();
      if (conn.state === signalR.HubConnectionState.Connected && watched.length) {
        // Báo máy chủ ngừng luồng trước khi đóng (đóng kết nối cũng đủ, đây là để dừng ngay).
        Promise.all(watched.map((id) => conn.invoke('Unwatch', id).catch(() => {}))).finally(() => {
          conn.stop().catch(() => {});
        });
      } else {
        conn.stop().catch(() => {});
      }
    };
  }, [branchId, syncWatches]);

  // Đổi danh sách thiết bị / tạm dừng / vừa kết nối → Watch/Unwatch cho khớp.
  useEffect(() => {
    desiredRef.current = deviceKey ? deviceKey.split(',') : [];
    syncWatches();
  }, [deviceKey, connectionState, syncWatches]);

  return { connectionState, frames, sources, error };
}
