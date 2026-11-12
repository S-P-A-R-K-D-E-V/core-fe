import type { ISalesOrderReceipt, ISalesOrderReceiptStore } from 'src/types/corecms-api';

import type { PrintKit } from './pos-print-kit';
import type { OutboxEntry } from './pos-outbox';

// ----------------------------------------------------------------------
// Phiếu thanh toán dựng tại máy cho hoá đơn chưa lên hệ thống (bán lúc mất mạng) — cùng dạng ISalesOrderReceipt máy
// chủ trả nên in bằng đúng bộ dựng phiếu / mẫu in hiện có. Mã hoá đơn là mã tạm; ghi chú báo mã chính thức cấp sau.
// ----------------------------------------------------------------------

export const OFFLINE_RECEIPT_NOTE = 'Phiếu bán lúc mất mạng — mã hoá đơn chính thức cấp khi đồng bộ.';

const METHOD_LABELS: Record<string, string> = {
  cash: 'Tiền mặt',
  transfer: 'Chuyển khoản',
  card: 'Thẻ',
  wallet: 'Ví điện tử',
  voucher: 'Voucher',
};

/** Như PrintTemplateRules.PaymentMethodKey của core-be. */
export function paymentMethodKey(method: string | null | undefined): string | null {
  switch ((method ?? '').trim().toLowerCase()) {
    case 'cash':
      return 'cash';
    case 'transfer':
    case 'banktransfer':
    case 'bank_transfer':
      return 'transfer';
    case 'card':
      return 'card';
    case 'wallet':
    case 'ewallet':
    case 'e-wallet':
      return 'wallet';
    case 'voucher':
      return 'voucher';
    default:
      return null;
  }
}

/** "dd/MM/yyyy HH:mm" theo giờ Việt Nam — như các trường "…Local" của phiếu máy chủ. */
export function formatVnLocal(iso: string): string {
  const d = new Date(Date.parse(iso) + 7 * 60 * 60 * 1000);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

type Options = {
  kit: PrintKit;
  /** Tên cửa hàng dự phòng khi chưa từng lưu được thông tin cửa hàng. */
  fallbackStoreName: string;
  cashierName: string | null;
  now?: Date;
};

export function buildOfflineReceipt(entry: OutboxEntry, { kit, fallbackStoreName, cashierName, now = new Date() }: Options): ISalesOrderReceipt {
  const { payload } = entry;
  const lines = payload.invoiceDetails.map((d, idx) => {
    const discount = d.discount ?? 0;
    return {
      lineNo: idx + 1,
      name: d.productName ?? d.productCode ?? '',
      code: d.productCode ?? null,
      unit: null,
      quantity: d.quantity,
      unitPrice: d.price,
      discount,
      lineTotal: d.quantity * d.price - discount,
      note: d.note ?? null,
    };
  });
  const subTotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const lineDiscounts = lines.reduce((s, l) => s + l.discount, 0);
  const orderDiscount = payload.discount ?? 0;
  const total = Math.max(0, Math.round(subTotal - lineDiscounts - orderDiscount));
  const payments = (payload.payments ?? []).filter((p) => p.amount > 0);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const cashPaid = payments.filter((p) => paymentMethodKey(p.method) === 'cash').reduce((s, p) => s + p.amount, 0);
  const tendered = payload.cashTendered ?? null;
  const soldAtLocal = formatVnLocal(entry.createdAt);
  const methodKeys = Array.from(new Set(payments.map((p) => paymentMethodKey(p.method))));

  const store: ISalesOrderReceiptStore = kit.store ?? {
    name: fallbackStoreName,
    address: null,
    phone: null,
    taxCode: null,
    logoUrl: null,
  };
  const note = [payload.note?.trim(), OFFLINE_RECEIPT_NOTE].filter(Boolean).join('\n');

  return {
    title: 'PHIẾU THANH TOÁN',
    store,
    branch: kit.branch,
    invoice: {
      id: entry.id,
      code: entry.offlineCode ?? entry.id.slice(0, 8).toUpperCase(),
      createdAtUtc: entry.createdAt,
      createdAtLocal: soldAtLocal,
      timezone: 'Asia/Ho_Chi_Minh',
      cashierName,
      customerName: entry.customerName ?? null,
      customerPhone: null,
      note,
      status: 'Completed',
      isCancelled: false,
    },
    lines,
    totals: {
      subTotal,
      discount: orderDiscount,
      discountTotal: Math.max(0, subTotal - total),
      total,
      paid,
      remaining: Math.max(0, total - paid),
      cashTendered: tendered,
      changeDue: tendered != null ? Math.max(0, tendered - cashPaid) : null,
    },
    payments: payments.map((p) => ({
      method: p.method,
      methodLabel: METHOD_LABELS[paymentMethodKey(p.method) ?? ''] ?? p.method,
      amount: p.amount,
      reference: p.transactionRef ?? null,
      paidAtLocal: soldAtLocal,
    })),
    transferQr: null,
    footer: kit.footer,
    printedAtLocal: formatVnLocal(now.toISOString()),
    channel: 'pos',
    paymentMethod: methodKeys.length === 1 ? methodKeys[0] : null,
  };
}
