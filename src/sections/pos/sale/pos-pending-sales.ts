import { useState, useEffect, useCallback } from 'react';

import type { ICreateSalesOrderRequest } from 'src/types/corecms-api';

import { isDefinitiveRejection } from './pos-sale-utils';

// ----------------------------------------------------------------------
// Hoá đơn bán lúc mất mạng / máy chủ lỗi — chờ đồng bộ (lưu trên máy, localStorage).
//
// Thu ngân bấm THANH TOÁN, khách đã trả tiền, nhưng yêu cầu tạo hoá đơn không tới được máy chủ (hoặc không biết máy chủ
// đã lưu chưa): hoá đơn vào hàng chờ với nguyên nội dung + mã chống trùng (clientRequestId) + giờ bán, màn bán hàng
// tiếp tục bán đơn khác. Có mạng lại thì gửi lại đúng yêu cầu đó — máy chủ trả hoá đơn đã tạo nếu lần trước thực ra đã
// lưu (không tạo trùng). Máy chủ từ chối hẳn (4xx) → giữ lại ở trạng thái lỗi để thu ngân mở lại thành giỏ và sửa.
// ----------------------------------------------------------------------

export const POS_PENDING_SALES_KEY = 'pos_pending_sales';

export type PendingSaleStatus = 'pending' | 'failed';

export type PendingSale = {
  /** = payload.clientRequestId */
  id: string;
  /** Yêu cầu tạo hoá đơn gửi lại nguyên vẹn (đã có purchaseDate = giờ bán). */
  payload: ICreateSalesOrderRequest;
  /** Nhãn tab lúc bán ("Hóa đơn 2") + tên khách — để thu ngân nhận ra. */
  label: string;
  customerName?: string;
  total: number;
  itemCount: number;
  createdAt: string;
  attempts: number;
  status: PendingSaleStatus;
  lastError?: string;
};

const CHANGE_EVENT = 'pos-pending-sales-change';

export function loadPendingSales(): PendingSale[] {
  try {
    const raw = localStorage.getItem(POS_PENDING_SALES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => s && typeof s.id === 'string' && s.payload) : [];
  } catch {
    return [];
  }
}

function savePendingSales(sales: PendingSale[]) {
  try {
    if (sales.length === 0) localStorage.removeItem(POS_PENDING_SALES_KEY);
    else localStorage.setItem(POS_PENDING_SALES_KEY, JSON.stringify(sales));
  } catch (e) {
    console.error('Không lưu được hoá đơn chờ đồng bộ', e);
  }
  // Báo cho các nơi khác trong cùng tab (sự kiện "storage" chỉ tới tab khác).
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT));
}

function updatePendingSales(update: (sales: PendingSale[]) => PendingSale[]) {
  savePendingSales(update(loadPendingSales()));
}

/** Thêm (hoặc thay — cùng mã chống trùng) một hoá đơn chờ đồng bộ. */
export function addPendingSale(sale: PendingSale) {
  updatePendingSales((sales) => [...sales.filter((s) => s.id !== sale.id), sale]);
}

export function removePendingSale(id: string) {
  updatePendingSales((sales) => sales.filter((s) => s.id !== id));
}

export function describeSaleError(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as { title?: string; message?: string; detail?: string };
    return e.title || e.detail || e.message || 'Máy chủ từ chối hoá đơn';
  }
  return 'Mất mạng hoặc máy chủ không trả lời';
}

export type SyncResult = { sent: number; failed: number; stillPending: number };

/**
 * Gửi lần lượt các hoá đơn chờ (bỏ qua hoá đơn đã lỗi 4xx — cần thu ngân xử lý). Gặp lỗi mạng thì dừng luôn: mạng
 * chưa có, gửi tiếp các hoá đơn sau cũng vô ích. Mỗi hoá đơn gửi xong được bỏ khỏi hàng chờ ngay (tắt máy giữa chừng
 * không gửi lại hoá đơn đã gửi — mà có gửi lại cũng không tạo trùng).
 */
export async function syncPendingSales(
  send: (payload: ICreateSalesOrderRequest) => Promise<{ id: string } | undefined>,
  onSent?: (sale: PendingSale, serverId: string | undefined) => void
): Promise<SyncResult> {
  const result: SyncResult = { sent: 0, failed: 0, stillPending: 0 };
  const queue = loadPendingSales().filter((s) => s.status === 'pending');

  for (let i = 0; i < queue.length; i += 1) {
    const sale = queue[i];
    try {
      // eslint-disable-next-line no-await-in-loop
      const created = await send(sale.payload);
      removePendingSale(sale.id);
      result.sent += 1;
      onSent?.(sale, created?.id);
    } catch (error) {
      if (isDefinitiveRejection(error)) {
        updatePendingSales((sales) =>
          sales.map((s) =>
            s.id === sale.id
              ? { ...s, status: 'failed', attempts: s.attempts + 1, lastError: describeSaleError(error) }
              : s
          )
        );
        result.failed += 1;
      } else {
        updatePendingSales((sales) =>
          sales.map((s) =>
            s.id === sale.id ? { ...s, attempts: s.attempts + 1, lastError: describeSaleError(error) } : s
          )
        );
        result.stillPending = queue.length - i;
        break;
      }
    }
  }
  return result;
}

/** Danh sách hoá đơn chờ, tự cập nhật khi hàng chờ đổi (cùng tab hoặc tab khác). */
export function usePendingSales(): PendingSale[] {
  const [sales, setSales] = useState<PendingSale[]>(() =>
    typeof window === 'undefined' ? [] : loadPendingSales()
  );
  const reload = useCallback(() => setSales(loadPendingSales()), []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === POS_PENDING_SALES_KEY) reload();
    };
    window.addEventListener(CHANGE_EVENT, reload);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, reload);
      window.removeEventListener('storage', onStorage);
    };
  }, [reload]);

  return sales;
}

// ----------------------------------------------------------------------
// Hoá đơn vừa bán trên máy này — cho menu "In lại" khi không đọc được danh sách từ máy chủ.
// ----------------------------------------------------------------------

export const POS_RECENT_SALES_KEY = 'pos_recent_sales';
const RECENT_LIMIT = 10;

export type RecentSale = { id: string; total: number; itemCount: number; customerName?: string; soldAt: string };

export function loadRecentSales(): RecentSale[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(POS_RECENT_SALES_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((s) => s && typeof s.id === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberRecentSale(sale: RecentSale) {
  try {
    const next = [sale, ...loadRecentSales().filter((s) => s.id !== sale.id)].slice(0, RECENT_LIMIT);
    localStorage.setItem(POS_RECENT_SALES_KEY, JSON.stringify(next));
  } catch {
    // không nhớ được thì menu in lại chỉ thiếu dòng này
  }
}
