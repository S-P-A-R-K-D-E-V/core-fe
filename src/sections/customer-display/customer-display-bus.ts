// ----------------------------------------------------------------------
// Màn hình khách (màn phụ ở quầy, hướng về khách): trang bán hàng đẩy trạng thái sang cửa sổ /customer-display qua
// BroadcastChannel (cùng trình duyệt, cùng tên miền — không qua máy chủ). Trạng thái hiện lên theo thứ tự ưu tiên:
// đã thanh toán (vài giây) > mã QR đang chờ khách quét > giỏ hàng > quảng cáo.
// Trang màn khách mới mở / tải lại gửi "hello" → trang bán hàng gửi lại trạng thái hiện tại.
// ----------------------------------------------------------------------

export const CUSTOMER_DISPLAY_CHANNEL = 'spark-customer-display';

/** Thời gian hiện "Cảm ơn quý khách" sau khi thanh toán xong. */
export const PAID_SCREEN_MS = 6_000;

export type CustomerDisplayLine = {
  key: string;
  name: string;
  detail?: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  amount: number;
};

export type CustomerDisplayCart = {
  lines: CustomerDisplayLine[];
  itemCount: number;
  subtotal: number;
  vat: number;
  orderDiscount: number;
  total: number;
  customerName?: string | null;
};

export type CustomerDisplayQr = {
  amount: number;
  imageSrc: string;
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  paymentCode?: string | null;
  expiresAt?: string | null;
};

export type CustomerDisplaySlide = { url: string; kind: 'image' | 'video'; title?: string | null };

export type CustomerDisplayAds = { intervalSeconds: number; slides: CustomerDisplaySlide[] };

export type CustomerDisplayView =
  | { mode: 'idle' }
  | { mode: 'cart'; cart: CustomerDisplayCart }
  | { mode: 'qr'; qr: CustomerDisplayQr; cart: CustomerDisplayCart | null }
  | { mode: 'paid'; amount: number };

export type CustomerDisplayMessage =
  | { type: 'state'; view: CustomerDisplayView; ads: CustomerDisplayAds | null; storeName: string | null; sentAt: number }
  | { type: 'hello' };

type BusState = {
  cart: CustomerDisplayCart | null;
  qr: CustomerDisplayQr | null;
  paid: { amount: number; until: number } | null;
  ads: CustomerDisplayAds | null;
  storeName: string | null;
};

const state: BusState = { cart: null, qr: null, paid: null, ads: null, storeName: null };

let channel: BroadcastChannel | null = null;
let paidTimer: ReturnType<typeof setTimeout> | undefined;

export function composeView(s: Pick<BusState, 'cart' | 'qr' | 'paid'>, now: number = Date.now()): CustomerDisplayView {
  if (s.paid && s.paid.until > now) return { mode: 'paid', amount: s.paid.amount };
  if (s.qr) return { mode: 'qr', qr: s.qr, cart: s.cart };
  if (s.cart && s.cart.lines.length > 0) return { mode: 'cart', cart: s.cart };
  return { mode: 'idle' };
}

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!channel) {
    channel = new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL);
    channel.onmessage = (event: MessageEvent<CustomerDisplayMessage>) => {
      if (event.data?.type === 'hello') publish();
    };
  }
  return channel;
}

function publish() {
  const ch = getChannel();
  if (!ch) return;
  const message: CustomerDisplayMessage = {
    type: 'state',
    view: composeView(state),
    ads: state.ads,
    storeName: state.storeName,
    sentAt: Date.now(),
  };
  try {
    ch.postMessage(message);
  } catch {
    // Kênh đã đóng (tab đang tắt) — bỏ qua.
  }
}

export const customerDisplay = {
  /** Giỏ hàng đang bán (null / rỗng = về quảng cáo). */
  setCart(cart: CustomerDisplayCart | null) {
    state.cart = cart;
    publish();
  },
  /** Mã QR chuyển khoản đang chờ khách quét (null = ẩn). */
  setQr(qr: CustomerDisplayQr | null) {
    state.qr = qr;
    publish();
  },
  /** Đã thanh toán: hiện "Cảm ơn" vài giây rồi về quảng cáo / giỏ tiếp theo. */
  paid(amount: number) {
    state.qr = null;
    state.paid = { amount, until: Date.now() + PAID_SCREEN_MS };
    publish();
    if (paidTimer) clearTimeout(paidTimer);
    paidTimer = setTimeout(() => {
      state.paid = null;
      publish();
    }, PAID_SCREEN_MS + 50);
  },
  setAds(ads: CustomerDisplayAds | null, storeName: string | null) {
    state.ads = ads;
    state.storeName = storeName;
    publish();
  },
  /** Gửi lại trạng thái (vd vừa mở cửa sổ màn khách). */
  republish: publish,
};

/** Đặt lại trạng thái (test). */
export function resetCustomerDisplayForTests() {
  state.cart = null;
  state.qr = null;
  state.paid = null;
  state.ads = null;
  state.storeName = null;
  channel?.close();
  channel = null;
}

// ----------------------------------------------------------------------
// Mở cửa sổ màn khách. Trình duyệt hỗ trợ Window Management API (Chrome/Edge, người dùng cho phép) thì đặt cửa sổ
// lên màn hình thứ hai; không thì mở cửa sổ thường để kéo sang màn hình phụ. Trang màn khách có nút toàn màn hình.

type ScreenDetailed = { left: number; top: number; availWidth: number; availHeight: number; isPrimary?: boolean };

export async function openCustomerDisplayWindow(): Promise<Window | null> {
  let features = 'popup=yes,width=1280,height=800';
  try {
    const w = window as unknown as { getScreenDetails?: () => Promise<{ screens: ScreenDetailed[]; currentScreen: ScreenDetailed }> };
    if (typeof w.getScreenDetails === 'function') {
      const details = await w.getScreenDetails();
      const other = details.screens.find((s) => s !== details.currentScreen) ?? null;
      if (other) {
        features = `popup=yes,left=${other.left},top=${other.top},width=${other.availWidth},height=${other.availHeight}`;
      }
    }
  } catch {
    // Người dùng không cho phép quản lý cửa sổ — mở cửa sổ thường.
  }
  const win = window.open('/customer-display/', 'spark-customer-display', features);
  // Cửa sổ mới cần chút thời gian để nghe kênh — trang đó tự gửi "hello", gửi thêm một lần cho chắc.
  setTimeout(publish, 800);
  return win;
}
