import { useRef, useState, useEffect, useCallback } from 'react';

import type { ICreateSalesOrderRequest, ICreateSalesOrderResponse } from 'src/types/corecms-api';

import { isDue, posOutbox, processOutbox, type Outbox, type OutboxEntry, type ProcessResult } from './pos-outbox';

// ----------------------------------------------------------------------
// Danh sách hàng chờ (tự cập nhật khi đổi — cùng tab hoặc tab khác)
// ----------------------------------------------------------------------

export function useOutboxEntries(outbox: Outbox = posOutbox()): OutboxEntry[] {
  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  useEffect(() => {
    let alive = true;
    const reload = () => {
      outbox
        .list()
        .then((rows) => {
          if (alive) setEntries(rows);
        })
        .catch((err) => console.error('Không đọc được hàng chờ hoá đơn', err));
    };
    reload();
    const unsubscribe = outbox.subscribe(reload);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [outbox]);
  return entries;
}

// ----------------------------------------------------------------------
// Trạng thái mạng: navigator.onLine + gõ nhịp tới máy chủ (mạng LAN còn mà mất Internet thì onLine vẫn true)
// ----------------------------------------------------------------------

const PING_INTERVAL_MS = 30 * 1000;
const PING_TIMEOUT_MS = 5 * 1000;

async function pingServer(): Promise<boolean> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), PING_TIMEOUT_MS);
  try {
    // File tĩnh nhỏ của chính máy chủ, không cache — chỉ để biết tới được máy chủ hay không.
    const res = await fetch(`/favicon/favicon-16x16.png?ping=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller?.signal,
    });
    return res.ok || res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export type Connectivity = {
  /** Trình duyệt có mạng VÀ tới được máy chủ. */
  online: boolean;
  /** Chỉ theo trình duyệt (navigator.onLine). */
  browserOnline: boolean;
  /** Bộ gửi báo kết quả lần gửi gần nhất (lỗi mạng = tạm coi như không tới được máy chủ). */
  report: (reachable: boolean) => void;
};

export function useConnectivity(): Connectivity {
  const [browserOnline, setBrowserOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [reachable, setReachable] = useState(true);

  useEffect(() => {
    const on = () => setBrowserOnline(true);
    const off = () => setBrowserOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    if (!browserOnline) return undefined;
    let alive = true;
    const check = () =>
      pingServer().then((ok) => {
        if (alive) setReachable(ok);
      });
    check();
    const timer = setInterval(check, PING_INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [browserOnline]);

  const report = useCallback((ok: boolean) => setReachable(ok), []);
  return { online: browserOnline && reachable, browserOnline, report };
}

// ----------------------------------------------------------------------
// Bộ gửi
// ----------------------------------------------------------------------

const AUTO_SYNC_INTERVAL_MS = 15 * 1000;
const LOCK_NAME = 'cici-pos-outbox';

type SenderOptions = {
  outbox?: Outbox;
  entries: OutboxEntry[];
  /** Chỉ theo trình duyệt — chính lần gửi là phép thử mạng thật. */
  browserOnline: boolean;
  send: (payload: ICreateSalesOrderRequest) => Promise<ICreateSalesOrderResponse | undefined>;
  onResult?: (result: ProcessResult, manual: boolean) => void;
};

/**
 * Gửi hàng chờ: khi có hoá đơn tới lượt, khi có mạng lại, 15 giây một lần, khi tab hiện lại, và khi bấm "Đồng bộ ngay".
 * `navigator.locks` giữ cho 2 tab / cửa sổ không gửi cùng lúc (gửi trùng vẫn không tạo trùng hoá đơn, chỉ tốn công).
 */
export function useOutboxSender({ outbox = posOutbox(), entries, browserOnline, send, onResult }: SenderOptions) {
  const [syncing, setSyncing] = useState(false);
  const runningRef = useRef(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const sendRef = useRef(send);
  sendRef.current = send;

  const run = useCallback(
    async (manual = false) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setSyncing(true);
      try {
        const exec = () => processOutbox(outbox, (payload) => sendRef.current(payload), { manual });
        const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
        const result = locks?.request
          ? await locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => (lock ? exec() : null))
          : await exec();
        if (result) onResultRef.current?.(result, manual);
      } catch (err) {
        console.error('Lỗi khi đồng bộ hàng chờ hoá đơn', err);
      } finally {
        runningRef.current = false;
        setSyncing(false);
      }
    },
    [outbox]
  );

  const hasUnsent = entries.some((e) => e.status === 'pending' || e.status === 'sending');
  const hasDueNow = entries.some((e) => isDue(e, Date.now(), false));

  // Có hoá đơn tới lượt (vừa ghi vào hàng chờ / vừa có mạng lại) → gửi ngay.
  useEffect(() => {
    if (browserOnline && hasDueNow) run();
  }, [browserOnline, hasDueNow, run]);

  // Còn hoá đơn chờ: 15 giây kiểm một lần (bộ gửi tự bỏ qua hoá đơn chưa hết thời gian lùi).
  useEffect(() => {
    if (!browserOnline || !hasUnsent) return undefined;
    const timer = setInterval(() => run(), AUTO_SYNC_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [browserOnline, hasUnsent, run]);

  return { syncing, syncNow: () => run(true) };
}
