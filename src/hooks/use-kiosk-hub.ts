'use client';

import * as signalR from '@microsoft/signalr';
import { useCallback, useEffect, useRef, useState } from 'react';

import { HOST_API } from 'src/config-global';
import { pushKioskDebugLog } from 'src/utils/kiosk-debug-log';

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
  // Chỉ log khi STATE của 1 track đổi (không log mỗi "tracks" message — tần suất ~6-7fps sẽ
  // spam log không đọc nổi). Đây là cách duy nhất để xem trực tiếp trên điện thoại/tablet track
  // có bao giờ chuyển sang EMBEDDED hay không — không cần vào log core-api (grep "KioskHub" đã
  // không ra dòng nào dù face-service xác nhận liveness PASS, cần xem phía client để biết
  // pipeline dừng ở bước nào: track không lên EMBEDDED, hay lên rồi mà identify không có phản hồi).
  const lastTrackStateRef = useRef<Record<string, string>>({});

  const [connectionState, setConnectionState] = useState<KioskConnectionState>('connecting');
  const [tracks, setTracks] = useState<IKioskTrack[]>([]);
  const [candidate, setCandidate] = useState<IKioskCandidateFound | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tên hiện trên khung nhận diện live phải LUÔN hiện khi track còn trong khung hình — tách khỏi
  // `candidate` (chỉ tồn tại trong lúc chờ xác nhận check-in/out, bị clear ngay sau khi confirm
  // xong). Không tách 2 state này thì sau khi auto-confirm xong (~4s) mà nhân viên vẫn đứng
  // nguyên trước cam, khung sẽ mất tên dù track chưa hề đổi — trông như "không nhận diện được"
  // dù thực ra đã chấm công thành công. Nhận diện lại chỉ chạy 1 lần/track (transition sang
  // EMBEDDED — xem KioskStreamSession) nên đây là tên gần nhất đã biết cho track đó, không phải
  // gọi lại BE liên tục (tránh lặp check-in/out ngoài ý muốn khi đứng lâu trước cam).
  const [trackLabels, setTrackLabels] = useState<Record<string, string>>({});

  const clearCandidate = useCallback(() => setCandidate(null), []);
  const clearError = useCallback(() => setError(null), []);

  // Dọn nhãn của track đã biến mất khỏi khung hình (người đã rời đi) — tránh rò rỉ state và
  // tránh gán nhầm tên cũ nếu trackId (lý thuyết) bị cấp phát lại.
  useEffect(() => {
    setTrackLabels((prev) => {
      const liveIds = new Set(tracks.map((t) => t.trackId));
      const next: Record<string, string> = {};
      let changed = false;
      Object.entries(prev).forEach(([id, name]) => {
        if (liveIds.has(id)) next[id] = name;
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [tracks]);

  useEffect(() => {
    if (!deviceKey) return undefined;

    setConnectionState('connecting');
    setTracks([]);
    setCandidate(null);
    setTrackLabels({});
    setError(null);
    seqRef.current = 0;
    lastTrackStateRef.current = {};

    const url = `${HOST_API || ''}/hubs/kiosk?kioskKey=${encodeURIComponent(deviceKey)}`;
    pushKioskDebugLog(`connect() bắt đầu — url=${url.replace(/kioskKey=[^&]+/, 'kioskKey=***')}`);

    let stoppedIntentionally = false;
    let manualRetryTimer: ReturnType<typeof setTimeout> | null = null;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(url)
      // Custom logger thay vì chỉ LogLevel — vừa in console vừa đẩy vào kioskDebugLog để xem
      // ngay trên màn hình (kiosk chạy trên điện thoại/tablet, không mở được DevTools). Bắt cả
      // log nội bộ của SignalR (chọn transport, fallback...) chứ không chỉ log tự viết.
      .configureLogging({
        log: (logLevel, message) => {
          if (logLevel < signalR.LogLevel.Warning) return;
          pushKioskDebugLog(`[signalr] ${message}`);
        },
      })
      // Không có option này thì SignalR KHÔNG tự nối lại — 1 lần WebSocket rớt (vd 1006 do
      // mạng chập chờn trên điện thoại/wifi kiosk) là kiosk đứng im vĩnh viễn ở màn "Mất kết nối
      // máy chủ" cho tới khi có người vào reload tay. Mảng delay là các lần retry TRONG 1 phiên
      // kết nối (onreconnecting/onreconnected) — nếu SignalR tự bỏ cuộc sau khi hết mảng này,
      // onclose bên dưới còn 1 vòng lặp retry thủ công riêng để không bao giờ bỏ cuộc hẳn.
      .withAutomaticReconnect([0, 2000, 5000, 10000, 15000, 30000])
      .build();

    conn.on('tracks', (raw: string) => {
      const parsed = parseTracksMessage(raw);
      setTracks(parsed);

      const liveIds = new Set<string>();
      parsed.forEach((t) => {
        liveIds.add(t.trackId);
        const prevState = lastTrackStateRef.current[t.trackId];
        if (prevState !== t.state) {
          lastTrackStateRef.current[t.trackId] = t.state;
          pushKioskDebugLog(
            `[track] ${t.trackId} ${prevState ?? '(mới)'} -> ${t.state} (quality=${t.quality?.toFixed(2) ?? '?'}, conf=${t.confidence.toFixed(2)})`
          );
        }
      });
      // Track rời khung hình (không còn trong "tracks") — dọn để lần sau quay lại tính là track mới.
      Object.keys(lastTrackStateRef.current).forEach((id) => {
        if (!liveIds.has(id)) {
          pushKioskDebugLog(`[track] ${id} rời khung hình (state cuối: ${lastTrackStateRef.current[id]})`);
          delete lastTrackStateRef.current[id];
        }
      });
    });
    conn.on('candidate_found', (payload: IKioskCandidateFound) => {
      pushKioskDebugLog(
        `[candidate_found] track=${payload.trackId} staff=${payload.staffName} action=${payload.action} similarity=${payload.similarity.toFixed(3)}`
      );
      setCandidate(payload);
      setTrackLabels((prev) => ({ ...prev, [payload.trackId]: payload.staffName }));
    });
    conn.on('error', (raw: unknown) => {
      const message = parseErrorMessage(raw);
      pushKioskDebugLog(`server error event: ${message}`);
      setError(message);
    });

    // Log lý do mất kết nối/đóng — trước đây "nuốt" luôn error argument nên khi reconnect loop
    // xảy ra không có cách nào biết BE đóng vì sao (401, hub exception, network...) ngoài việc
    // lục log server (mà nhiều khi log server cũng không bắt được nếu lỗi xảy ra ở tầng
    // transport/negotiate trước khi vào tới Hub code).
    conn.onreconnecting((err) => {
      pushKioskDebugLog(`reconnecting — lý do mất kết nối trước đó: ${err?.message ?? err ?? '(không rõ)'}`);
      setConnectionState('reconnecting');
    });
    conn.onreconnected(() => {
      pushKioskDebugLog('reconnected OK');
      setConnectionState('connected');
    });
    // Retry thủ công KHÔNG GIỚI HẠN SỐ LẦN — chạy khi SignalR tự bỏ cuộc sau khi hết mảng delay
    // của withAutomaticReconnect, hoặc khi start() ban đầu thất bại (server down lúc mở app).
    // Kiosk là thiết bị chạy 24/7 không người trông — thà retry vô hạn còn hơn đứng im chờ người
    // vào reload tay. Backoff tăng dần, trần 30s để không spam server khi mất mạng dài.
    function scheduleManualRetry(delayMs: number, reason: string) {
      if (stoppedIntentionally) return;
      pushKioskDebugLog(`tự kết nối lại sau ${delayMs}ms (${reason})`);
      manualRetryTimer = setTimeout(() => {
        if (stoppedIntentionally) return;
        setConnectionState('reconnecting');
        conn
          .start()
          .then(() => {
            pushKioskDebugLog('tự kết nối lại thành công');
            connRef.current = conn;
            setConnectionState('connected');
          })
          .catch((err) => {
            const message = String(err?.message ?? err ?? '');
            pushKioskDebugLog(`tự kết nối lại thất bại — ${message}`);
            if (/401|unauthorized/i.test(message)) {
              // Khoá thiết bị bị thu hồi — retry vô hạn vô ích, cần người vào đổi thiết bị.
              setError('Khoá thiết bị không hợp lệ hoặc đã bị thu hồi — bấm "Đổi thiết bị" để ghép nối lại.');
              return;
            }
            scheduleManualRetry(Math.min(delayMs * 2, 30000), 'lần trước vẫn thất bại');
          });
      }, delayMs);
    }

    conn.onclose((err) => {
      pushKioskDebugLog(`connection closed — ${err?.message ?? err ?? '(không rõ)'}`);
      setConnectionState('disconnected');
      scheduleManualRetry(3000, 'automatic reconnect đã bỏ cuộc hoặc connection closed');
    });

    conn
      .start()
      .then(() => {
        pushKioskDebugLog('connect() thành công');
        connRef.current = conn;
        setConnectionState('connected');
      })
      .catch((err) => {
        pushKioskDebugLog(`connect() thất bại — ${err?.message ?? err ?? '(không rõ)'}`);
        setConnectionState('disconnected');
        const message = String(err?.message ?? err ?? '');
        // Khoá thiết bị sai/đã bị thu hồi → BE trả 401 ngay lúc negotiate, KHÁC lỗi mạng thật sự
        // (timeout, DNS...). Phân biệt rõ để người dùng biết cần "Đổi thiết bị" chứ không phải
        // chờ mạng ổn định lại (xem KioskAuthenticationHandler).
        if (/401|unauthorized/i.test(message)) {
          setError('Khoá thiết bị không hợp lệ hoặc đã bị thu hồi — bấm "Đổi thiết bị" để ghép nối lại.');
          return;
        }
        setError('Không kết nối được máy chủ');
        scheduleManualRetry(3000, 'start() ban đầu thất bại');
      });

    return () => {
      stoppedIntentionally = true;
      if (manualRetryTimer) clearTimeout(manualRetryTimer);
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

  return { connectionState, tracks, candidate, trackLabels, error, clearCandidate, clearError, sendFrame };
}
