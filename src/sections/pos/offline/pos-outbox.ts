import type { ICreateSalesOrderRequest, ICreateSalesOrderResponse } from 'src/types/corecms-api';

import { isDefinitiveRejection } from '../sale/pos-sale-utils';

import { openPosStore, type PosKvStore } from './pos-store';

// ----------------------------------------------------------------------
// Hàng chờ hoá đơn (outbox) của màn bán hàng — docs/cici/plans/pos-offline-plan.md, GĐ1.
//
// MỌI lần bán đi qua đây: bấm THANH TOÁN → ghi hoá đơn xuống máy (IndexedDB, ghi bền) → gửi. Có mạng thì gửi ngay như
// trước; mất mạng / máy chủ lỗi thì hoá đơn nằm chờ, bộ gửi tự gửi lại (cùng mã chống trùng clientRequestId — máy chủ
// đã lưu từ lần trước thì trả lại hoá đơn đó, không tạo trùng). Tắt trình duyệt / mất điện giữa lúc gửi: mở lại màn bán
// hàng là gửi tiếp. Máy chủ từ chối hẳn (4xx nghiệp vụ) → "lỗi", thu ngân mở lại sửa / gửi lại / bỏ.
// ----------------------------------------------------------------------

/**
 * pending = chờ gửi; sending = đang gửi (kẹt ở trạng thái này quá lâu = trình duyệt tắt giữa chừng → gửi lại);
 * sent = đã lên hệ thống (giữ 7 ngày để in lại); failed = máy chủ từ chối, cần thu ngân xử lý.
 */
export type OutboxStatus = 'pending' | 'sending' | 'sent' | 'failed';

export type OutboxEntry = {
  /** = payload.clientRequestId */
  id: string;
  /** Yêu cầu tạo hoá đơn như lúc bán (chưa có purchaseDate / offline — bộ gửi thêm khi gửi lại). */
  payload: ICreateSalesOrderRequest;
  /** Nhãn tab lúc bán ("Hóa đơn 2") + tên khách — để thu ngân nhận ra. */
  label: string;
  customerName?: string;
  total: number;
  itemCount: number;
  /** Giờ bán (ISO, UTC) — gửi lại thì thành purchaseDate của hoá đơn. */
  createdAt: string;
  status: OutboxStatus;
  attempts: number;
  lastAttemptAt?: string;
  /** Chưa tới giờ này thì bộ gửi tự động bỏ qua (lùi dần sau mỗi lần lỗi mạng). */
  nextAttemptAt?: string;
  lastError?: string;
  serverId?: string;
  sentAt?: string;
};

export const SENT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
/** Hoá đơn "đang gửi" quá lâu = trang đã tắt giữa chừng → coi như chờ gửi. */
export const STALE_SENDING_MS = 60 * 1000;
const MIN_BACKOFF_MS = 5 * 1000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

/** Lùi dần sau lỗi mạng: 5 s, 10 s, 20 s… tối đa 5 phút. */
export function backoffMs(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, MIN_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
}

export const isUnsent = (e: OutboxEntry) => e.status !== 'sent';

export function describeSaleError(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as { title?: string; message?: string; detail?: string };
    return e.title || e.detail || e.message || 'Máy chủ từ chối hoá đơn';
  }
  return 'Mất mạng hoặc máy chủ không trả lời';
}

/** Hoá đơn tới lượt gửi (tự động: tôn trọng thời gian lùi; bấm tay: gửi ngay). */
export function isDue(entry: OutboxEntry, now: number, manual: boolean): boolean {
  if (entry.status === 'pending') {
    return manual || !entry.nextAttemptAt || Date.parse(entry.nextAttemptAt) <= now;
  }
  if (entry.status === 'sending') {
    const last = entry.lastAttemptAt ? Date.parse(entry.lastAttemptAt) : 0;
    return now - last >= STALE_SENDING_MS;
  }
  return false;
}

/** Yêu cầu gửi lại từ hàng chờ: thêm giờ bán thật + cờ offline (máy chủ ghi "Bán offline lúc …"). */
export function retryPayload(entry: OutboxEntry): ICreateSalesOrderRequest {
  return { ...entry.payload, purchaseDate: entry.createdAt, offline: true };
}

// ----------------------------------------------------------------------

type Listener = () => void;

export type Outbox = {
  /** Kho có ghi bền không (IndexedDB) — false thì màn hình cảnh báo. */
  durable(): Promise<boolean>;
  list(): Promise<OutboxEntry[]>;
  put(entry: OutboxEntry): Promise<void>;
  update(id: string, patch: Partial<OutboxEntry>): Promise<OutboxEntry | undefined>;
  remove(id: string): Promise<void>;
  /** Bỏ hoá đơn đã gửi quá 7 ngày. */
  prune(now?: number): Promise<void>;
  subscribe(listener: Listener): () => void;
};

export function createOutbox(storePromise: Promise<PosKvStore<OutboxEntry>>, channelName?: string): Outbox {
  const listeners = new Set<Listener>();
  // Báo cho tab / cửa sổ khác của màn bán hàng (2 máy cùng trình duyệt hoặc mở 2 tab).
  const channel =
    channelName && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(channelName) : null;
  const emit = (broadcast: boolean) => {
    listeners.forEach((l) => l());
    if (broadcast) channel?.postMessage('changed');
  };
  if (channel) {
    channel.onmessage = () => emit(false);
    // Node (test) giữ tiến trình sống khi còn kênh mở — trình duyệt không có unref.
    (channel as unknown as { unref?: () => void }).unref?.();
  }

  const outbox: Outbox = {
    durable: async () => (await storePromise).durable,
    list: async () => {
      const rows = await (await storePromise).getAll();
      return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    put: async (entry) => {
      await (await storePromise).put(entry);
      emit(true);
    },
    update: async (id, patch) => {
      const store = await storePromise;
      const current = (await store.getAll()).find((e) => e.id === id);
      if (!current) return undefined;
      const next = { ...current, ...patch };
      await store.put(next);
      emit(true);
      return next;
    },
    remove: async (id) => {
      await (await storePromise).remove(id);
      emit(true);
    },
    prune: async (now = Date.now()) => {
      const store = await storePromise;
      const old = (await store.getAll()).filter(
        (e) => e.status === 'sent' && now - Date.parse(e.sentAt ?? e.createdAt) > SENT_RETENTION_MS
      );
      if (old.length === 0) return;
      await Promise.all(old.map((e) => store.remove(e.id)));
      emit(true);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return outbox;
}

// ----------------------------------------------------------------------
// Bộ gửi
// ----------------------------------------------------------------------

export type ProcessResult = {
  sent: OutboxEntry[];
  failed: OutboxEntry[];
  /** Gặp lỗi mạng → dừng (gửi tiếp các hoá đơn sau cũng vô ích). */
  networkDown: boolean;
};

export async function processOutbox(
  outbox: Outbox,
  send: (payload: ICreateSalesOrderRequest) => Promise<ICreateSalesOrderResponse | undefined>,
  { manual = false, now = () => Date.now() }: { manual?: boolean; now?: () => number } = {}
): Promise<ProcessResult> {
  const result: ProcessResult = { sent: [], failed: [], networkDown: false };
  const due = (await outbox.list()).filter((e) => isDue(e, now(), manual));

  for (let i = 0; i < due.length; i += 1) {
    const entry = due[i];
    const attempts = entry.attempts + 1;
    // eslint-disable-next-line no-await-in-loop
    await outbox.update(entry.id, { status: 'sending', attempts, lastAttemptAt: new Date(now()).toISOString() });
    try {
      // eslint-disable-next-line no-await-in-loop
      const created = await send(retryPayload(entry));
      // eslint-disable-next-line no-await-in-loop
      const sent = await outbox.update(entry.id, {
        status: 'sent',
        serverId: created?.id,
        sentAt: new Date(now()).toISOString(),
        lastError: undefined,
        nextAttemptAt: undefined,
      });
      if (sent) result.sent.push(sent);
    } catch (error) {
      if (isDefinitiveRejection(error)) {
        // eslint-disable-next-line no-await-in-loop
        const failed = await outbox.update(entry.id, { status: 'failed', lastError: describeSaleError(error) });
        if (failed) result.failed.push(failed);
      } else {
        // eslint-disable-next-line no-await-in-loop
        await outbox.update(entry.id, {
          status: 'pending',
          lastError: describeSaleError(error),
          nextAttemptAt: new Date(now() + backoffMs(attempts)).toISOString(),
        });
        result.networkDown = true;
        break;
      }
    }
  }
  return result;
}

// ----------------------------------------------------------------------
// Hàng chờ của màn bán hàng (một bản cho cả trang) + chuyển dữ liệu cũ
// ----------------------------------------------------------------------

/** Khoá localStorage của bản GĐ0 (hàng chờ + hoá đơn vừa bán) — chuyển sang outbox rồi xoá. */
const LEGACY_PENDING_KEY = 'pos_pending_sales';
const LEGACY_RECENT_KEY = 'pos_recent_sales';

let shared: Outbox | null = null;

export function posOutbox(): Outbox {
  if (!shared) {
    const store = openPosStore<OutboxEntry>('outbox');
    shared = createOutbox(store, 'cici-pos-outbox');
    migrateLegacy(shared).catch((err) => console.error('Không chuyển được hàng chờ cũ', err));
  }
  return shared;
}

async function migrateLegacy(outbox: Outbox) {
  if (typeof localStorage === 'undefined') return;
  let legacy: any[] = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(LEGACY_PENDING_KEY) ?? '[]');
    legacy = Array.isArray(parsed) ? parsed : [];
  } catch {
    legacy = [];
  }
  for (let i = 0; i < legacy.length; i += 1) {
    const s = legacy[i];
    if (s && typeof s.id === 'string' && s.payload) {
      // purchaseDate cũ nằm trong payload — bộ gửi tự thêm từ createdAt.
      const { purchaseDate, ...payload } = s.payload;
      // eslint-disable-next-line no-await-in-loop
      await outbox.put({
        id: s.id,
        payload,
        label: s.label ?? 'Hoá đơn',
        customerName: s.customerName,
        total: Number(s.total) || 0,
        itemCount: Number(s.itemCount) || 0,
        createdAt: s.createdAt ?? purchaseDate ?? new Date().toISOString(),
        status: s.status === 'failed' ? 'failed' : 'pending',
        attempts: Number(s.attempts) || 0,
        lastError: s.lastError,
      });
    }
  }
  localStorage.removeItem(LEGACY_PENDING_KEY);
  localStorage.removeItem(LEGACY_RECENT_KEY);
}
