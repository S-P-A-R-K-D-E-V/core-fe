import type {
  BankTxnStatus,
  PaymentProvider,
  OnlineOrderStatus,
  PaymentIntentStatus,
  IPaymentStatusChangedEvent,
} from 'src/types/payment-service';

// ----------------------------------------------------------------------
// Trạng thái thanh toán dùng chung: sự kiện SignalR PaymentStatusChanged, đếm ngược hết hạn QR, nhãn trạng thái của
// màn đối soát / đơn online.
// ----------------------------------------------------------------------

/** Tên window event mà SyncNotificationProvider phát lại khi hub gửi PaymentStatusChanged. */
export const PAYMENT_STATUS_EVENT = 'payment-status-changed';

/**
 * SignalR giữ nguyên kiểu chữ property của .NET → payload có thể là PascalCase tuỳ bản build BE (xem
 * normalizeNotification). Chuẩn hoá về camelCase; status viết hoa. Không phải object / thiếu intentId → null.
 */
export function normalizePaymentStatusEvent(raw: unknown): IPaymentStatusChangedEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const pick = (camel: string) => r[camel] ?? r[camel.charAt(0).toUpperCase() + camel.slice(1)];
  const str = (camel: string) => {
    const v = pick(camel);
    return v === null || v === undefined || v === '' ? undefined : String(v);
  };

  const intentId = str('intentId');
  if (!intentId) return null;

  return {
    intentId,
    qrOrderId: str('qrOrderId'),
    onlineOrderId: str('onlineOrderId'),
    status: String(pick('status') ?? 'PENDING').toUpperCase() as IPaymentStatusChangedEvent['status'],
    amount: Number(pick('amount') ?? 0),
    amountReceived: Number(pick('amountReceived') ?? 0),
    paymentCode: str('paymentCode'),
    salesOrderId: str('salesOrderId'),
  };
}

/** Sự kiện có phải của mã QR đang hiện không (Guid so không phân biệt hoa thường). */
export function isEventForQr(event: IPaymentStatusChangedEvent, qrOrderId: string | null | undefined): boolean {
  return !!qrOrderId && !!event.qrOrderId && event.qrOrderId.toLowerCase() === qrOrderId.toLowerCase();
}

export type QrOutcome = 'pending' | 'completed' | 'cancelled' | 'expired';

/** Trạng thái QR (poll hoặc SignalR) → POS làm gì. */
export function qrOutcome(status: string | null | undefined): QrOutcome {
  switch ((status ?? '').toUpperCase()) {
    case 'COMPLETED':
      return 'completed';
    case 'CANCELLED':
    case 'ERRORCORRECTED':
      return 'cancelled';
    case 'EXPIRED':
      return 'expired';
    default:
      return 'pending';
  }
}

/** Số giây còn lại tới expiresAt (không âm). Không có / sai định dạng → null (backend tắt dịch vụ: không đếm ngược). */
export function secondsUntil(expiresAt: string | null | undefined, now: number = Date.now()): number | null {
  if (!expiresAt) return null;
  const at = new Date(expiresAt).getTime();
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.ceil((at - now) / 1000));
}

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

// ---------------------------------------------------------------------- Nhãn

type ChipColor = 'default' | 'info' | 'success' | 'warning' | 'error';

export const PAYMENT_PROVIDER_LABEL: Record<string, string> = {
  sepay: 'SePay',
  casso: 'Casso',
  payos: 'payOS',
  vnpay: 'VNPay',
  acb: 'ACB',
  bidv: 'BIDV',
  mbbank: 'MB Bank',
  mockbank: 'Ngân hàng giả lập',
  apipay: 'ApiPay',
};

/** Tên ngắn của nhà cung cấp; khoá lạ (danh mục thêm nhà mới) hiện nguyên bản. */
export function paymentProviderLabel(provider: PaymentProvider | null | undefined): string {
  if (!provider) return '—';
  return PAYMENT_PROVIDER_LABEL[provider] ?? provider;
}

/**
 * Mã giao dịch ghi vào hoá đơn khi khách trả bằng mã QR ở quầy: mã thanh toán (SP + 7 ký tự) để core-be gắn QR với hoá
 * đơn (mục 7c); dịch vụ thanh toán tắt (không có mã) → số trace của ngân hàng, rồi 8 ký tự đầu id QR như trước.
 */
export function qrTransactionRef(qr: { id: string; paymentCode?: string | null; traceNumber?: string | null }): string {
  return qr.paymentCode || qr.traceNumber || qr.id.slice(0, 8);
}

export const PAYMENT_INTENT_STATUS: Record<PaymentIntentStatus, { label: string; color: ChipColor }> = {
  pending: { label: 'Chờ thanh toán', color: 'info' },
  partially_paid: { label: 'Trả thiếu', color: 'warning' },
  paid: { label: 'Đã thanh toán', color: 'success' },
  expired: { label: 'Hết hạn', color: 'default' },
  cancelled: { label: 'Đã huỷ', color: 'default' },
  failed: { label: 'Thất bại', color: 'error' },
};

export const BANK_TXN_STATUS: Record<BankTxnStatus, { label: string; color: ChipColor }> = {
  matched: { label: 'Đã khớp', color: 'success' },
  unmatched: { label: 'Chưa khớp', color: 'warning' },
  ignored: { label: 'Bỏ qua', color: 'default' },
};

export const ONLINE_ORDER_STATUS: Record<OnlineOrderStatus, { label: string; color: ChipColor }> = {
  pending_payment: { label: 'Chờ thanh toán', color: 'warning' },
  paid: { label: 'Đã thanh toán', color: 'success' },
  cancelled: { label: 'Đã huỷ', color: 'default' },
  expired: { label: 'Hết hạn', color: 'default' },
};

export const PAYMENT_ORDER_TYPE_LABEL: Record<string, string> = {
  pos_qr: 'QR bán lẻ',
  fnb_order: 'Đơn F&B',
  online_order: 'Đơn online',
};

export const ONLINE_PAYMENT_METHOD_LABEL: Record<string, string> = {
  bank_transfer: 'Chuyển khoản (VietQR)',
  payos: 'payOS',
  vnpay: 'VNPay',
};

export const PAYMENT_FLAG_LABEL: Record<string, string> = {
  late: 'Về trễ',
  overpaid: 'Trả dư',
};

/** Nhãn + màu của một trạng thái; giá trị lạ (BE thêm trạng thái mới) vẫn hiện nguyên bản. */
export function statusChip<K extends string>(
  map: Record<K, { label: string; color: ChipColor }>,
  status: string | null | undefined
): { label: string; color: ChipColor } {
  return (status && map[status as K]) || { label: status || '—', color: 'default' };
}
