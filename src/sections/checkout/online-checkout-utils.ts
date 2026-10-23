import type { ICheckoutItem } from 'src/types/checkout';
import type { IStorefrontShippingQuote, IStorefrontShippingOption } from 'src/types/online-shop';

// ----------------------------------------------------------------------
// Trang đặt hàng online (thuần — test được). Giá, phí ship, tổng tiền đều do máy chủ tính lại khi đặt; số ở trình duyệt
// chỉ để khách xem trước.
// ----------------------------------------------------------------------

export function orderItems(items: ICheckoutItem[]): { productId: string; quantity: number }[] {
  return items.filter((i) => i.quantity > 0).map((i) => ({ productId: i.id, quantity: i.quantity }));
}

/** "+84 912.345.678" → "0912345678"; null nếu không phải số di động / cố định VN hợp lệ (giống máy chủ). */
export function normalizeVnPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+84')) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith('84') && digits.length >= 11) digits = `0${digits.slice(2)}`;
  return /^0\d{9,10}$/.test(digits) ? digits : null;
}

export type AddressDraft = { provinceCode: string; wardCode: string; street: string };

export function addressReady(a: AddressDraft): boolean {
  return !!a.provinceCode && !!a.wardCode && a.street.trim().length >= 3;
}

/** Hãng đang chọn: chế độ "choose" giữ lựa chọn của khách nếu còn trong báo giá mới, không thì hãng máy chủ chọn sẵn. */
export function pickShippingOption(
  quote: IStorefrontShippingQuote | null,
  chosen: { connectionId: string; service?: string | null } | null
): IStorefrontShippingOption | null {
  if (!quote) return null;
  if (quote.carrierSelection === 'choose' && chosen) {
    const same = quote.options.find((o) => o.connectionId === chosen.connectionId && (o.service ?? null) === (chosen.service ?? null));
    if (same) return same;
  }
  return quote.selected ?? quote.options[0] ?? null;
}

/** "Thứ bảy, 25/10" — ngày giao dự kiến theo giờ Việt Nam. */
export function formatEta(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
}

/** Thông điệp máy chủ báo phí ship đổi → lấy số mới để hỏi khách. */
export function isShippingFeeChanged(err: any): boolean {
  if (!err || typeof err !== 'object') return false;
  if (Array.isArray(err.errorCodes) && err.errorCodes.includes('OnlineOrder.ShippingFeeChanged')) return true;
  return typeof err.title === 'string' && err.title.startsWith('Phí giao hàng vừa cập nhật');
}

// ---- Đơn gần đây của khách trên máy này (mở lại trang đơn để xem QR / trạng thái) ----

export const RECENT_ORDERS_KEY = 'shop.recentOrders';
const MAX_RECENT = 5;

export type RecentOrder = { code: string; token: string; at: string };

export function readRecentOrders(): RecentOrder[] {
  try {
    const raw = window.localStorage.getItem(RECENT_ORDERS_KEY);
    const list = raw ? (JSON.parse(raw) as RecentOrder[]) : [];
    return Array.isArray(list) ? list.filter((o) => o && typeof o.code === 'string' && typeof o.token === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberOrder(code: string, token: string, now = new Date()): RecentOrder[] {
  const next = [{ code, token, at: now.toISOString() }, ...readRecentOrders().filter((o) => o.code !== code)].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(next));
  } catch {
    // Trình duyệt chặn lưu trữ — khách vẫn có link trong thanh địa chỉ.
  }
  return next;
}

export function orderHref(code: string, token: string): string {
  return `/order/${encodeURIComponent(code)}/?t=${encodeURIComponent(token)}`;
}
