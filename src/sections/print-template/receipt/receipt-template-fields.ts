import type {
  ISalesOrderReceipt,
  ISalesOrderReceiptLine,
  ISalesOrderReceiptPayment,
} from 'src/types/corecms-api';

import { moneyInWords } from '../money-words';
import { formatReceiptMoney, formatReceiptQuantity } from '../../pos/receipt-print/receipt-html';

// ----------------------------------------------------------------------
// Trường trộn của mẫu hoá đơn: mã `{{ma}}` → giá trị lấy từ phiếu thanh toán (GET /sales-orders/{id}/receipt).
//  - Trường dòng hàng (`item_*`) và thanh toán (`payment_*`): khối chứa chúng được lặp theo từng dòng / từng khoản thu.
//  - Trường "ẩn khi 0" (giảm giá, còn phải trả, tiền thừa…) trả chuỗi rỗng khi không có — đoạn / hàng bảng mà mọi trường
//    đều rỗng thì tự ẩn khi in.
//  - Trường khối (`transfer_qr`, `invoice_barcode`, `invoice_qr`, `cancelled_banner`) là hình / khung, dựng khi in.
// ----------------------------------------------------------------------

export type ReceiptFieldGroup =
  | 'store'
  | 'invoice'
  | 'item'
  | 'total'
  | 'payment'
  | 'transfer'
  | 'code';

export type ReceiptFieldDef = {
  key: string;
  label: string;
  group: ReceiptFieldGroup;
  /** Ghi chú ngắn trong bảng trường. */
  hint?: string;
  /** Trường hình / khung (mã QR, mã vạch, dấu đã huỷ). */
  block?: boolean;
};

export const RECEIPT_FIELD_GROUPS: { key: ReceiptFieldGroup; label: string; hint?: string }[] = [
  { key: 'store', label: 'Cửa hàng' },
  { key: 'invoice', label: 'Hoá đơn' },
  {
    key: 'item',
    label: 'Dòng hàng',
    hint: 'Đoạn / hàng bảng chứa trường này được lặp cho từng món.',
  },
  { key: 'total', label: 'Tổng tiền' },
  {
    key: 'payment',
    label: 'Thanh toán',
    hint: 'Đoạn / hàng bảng chứa trường khoản thu được lặp cho từng khoản.',
  },
  { key: 'transfer', label: 'Chuyển khoản (VietQR)' },
  { key: 'code', label: 'Mã vạch / QR hoá đơn' },
];

export const RECEIPT_FIELDS: ReceiptFieldDef[] = [
  { key: 'store_name', label: 'Tên cửa hàng', group: 'store' },
  {
    key: 'branch_name',
    label: 'Tên chi nhánh',
    group: 'store',
    hint: 'Trống khi trùng tên cửa hàng',
  },
  { key: 'store_address', label: 'Địa chỉ', group: 'store', hint: 'Của chi nhánh nếu có' },
  { key: 'store_phone', label: 'Điện thoại', group: 'store' },
  { key: 'store_tax_code', label: 'Mã số thuế', group: 'store' },

  { key: 'invoice_title', label: 'Tiêu đề phiếu', group: 'invoice' },
  { key: 'invoice_code', label: 'Mã hoá đơn', group: 'invoice' },
  { key: 'invoice_date', label: 'Ngày giờ bán', group: 'invoice' },
  { key: 'cashier_name', label: 'Thu ngân', group: 'invoice' },
  { key: 'customer_name', label: 'Khách hàng', group: 'invoice', hint: '"Khách lẻ" khi không có' },
  { key: 'customer_phone', label: 'SĐT khách', group: 'invoice' },
  { key: 'invoice_note', label: 'Ghi chú hoá đơn', group: 'invoice' },
  { key: 'channel_name', label: 'Kênh bán', group: 'invoice' },
  { key: 'printed_at', label: 'Thời điểm in', group: 'invoice' },
  {
    key: 'cancelled_banner',
    label: 'Dấu "ĐÃ HUỶ"',
    group: 'invoice',
    block: true,
    hint: 'Chỉ hiện khi hoá đơn đã huỷ',
  },

  { key: 'item_no', label: 'STT', group: 'item' },
  { key: 'item_name', label: 'Tên hàng', group: 'item' },
  { key: 'item_code', label: 'Mã hàng', group: 'item' },
  { key: 'item_unit', label: 'Đơn vị tính', group: 'item' },
  { key: 'item_quantity', label: 'Số lượng', group: 'item' },
  { key: 'item_price', label: 'Đơn giá', group: 'item' },
  { key: 'item_discount', label: 'Giảm giá dòng', group: 'item', hint: 'Trống khi không giảm' },
  { key: 'item_total', label: 'Thành tiền', group: 'item' },
  { key: 'item_note', label: 'Ghi chú món', group: 'item' },

  { key: 'subtotal', label: 'Tổng tiền hàng', group: 'total' },
  { key: 'discount_total', label: 'Tổng giảm giá', group: 'total', hint: 'Trống khi 0' },
  { key: 'other_charges', label: 'Thu khác', group: 'total', hint: 'Trống khi 0' },
  { key: 'total', label: 'Khách cần trả', group: 'total' },
  { key: 'total_in_words', label: 'Khách cần trả (bằng chữ)', group: 'total' },
  { key: 'paid', label: 'Khách đã trả', group: 'total' },
  {
    key: 'cash_tendered',
    label: 'Tiền khách đưa',
    group: 'total',
    hint: 'Trống khi không có tiền thừa',
  },
  { key: 'change_due', label: 'Tiền thừa trả khách', group: 'total', hint: 'Trống khi 0' },
  { key: 'remaining', label: 'Còn phải trả', group: 'total', hint: 'Trống khi đã trả đủ' },
  { key: 'item_count', label: 'Số mặt hàng', group: 'total' },
  { key: 'total_quantity', label: 'Tổng số lượng', group: 'total' },

  {
    key: 'payment_summary',
    label: 'Phương thức (gộp)',
    group: 'payment',
    hint: 'Vd. "Tiền mặt, Chuyển khoản"',
  },
  { key: 'payment_method', label: 'Phương thức', group: 'payment' },
  { key: 'payment_amount', label: 'Số tiền thu', group: 'payment' },
  { key: 'payment_reference', label: 'Mã giao dịch', group: 'payment' },
  { key: 'payment_time', label: 'Thời gian thu', group: 'payment' },

  {
    key: 'transfer_qr',
    label: 'Mã QR chuyển khoản',
    group: 'transfer',
    block: true,
    hint: 'Chỉ khi còn phải trả',
  },
  { key: 'transfer_bank', label: 'Ngân hàng', group: 'transfer' },
  { key: 'transfer_account_number', label: 'Số tài khoản', group: 'transfer' },
  { key: 'transfer_account_name', label: 'Tên tài khoản', group: 'transfer' },
  { key: 'transfer_amount', label: 'Số tiền chuyển', group: 'transfer' },
  { key: 'transfer_content', label: 'Nội dung chuyển khoản', group: 'transfer' },

  { key: 'invoice_barcode', label: 'Mã vạch mã hoá đơn', group: 'code', block: true },
  { key: 'invoice_qr', label: 'Mã QR mã hoá đơn', group: 'code', block: true },

  {
    key: 'footer',
    label: 'Lời chào cuối phiếu',
    group: 'store',
    hint: 'Cài đặt cửa hàng → Thông tin',
  },
];

export const RECEIPT_FIELD_KEYS = new Set(RECEIPT_FIELDS.map((field) => field.key));

export const BLOCK_FIELD_KEYS = new Set(
  RECEIPT_FIELDS.filter((field) => field.block).map((field) => field.key)
);

export const isItemField = (key: string) => key.startsWith('item_') && key !== 'item_count';

export const isPaymentField = (key: string) =>
  key.startsWith('payment_') && key !== 'payment_summary';

// ── Giá trị ───────────────────────────────────────────────────────────────

const clean = (text: string | null | undefined) => (text ?? '').trim();

const moneyOrEmpty = (amount: number | null | undefined) =>
  amount !== null && amount !== undefined && Math.round(amount) !== 0
    ? formatReceiptMoney(amount)
    : '';

const CHANNEL_NAMES: Record<string, string> = {
  pos: 'Bán tại quầy',
  fnb: 'F&B',
  online: 'Đơn online',
};

const paymentLabel = (payment: ISalesOrderReceiptPayment) =>
  clean(payment.methodLabel) || clean(payment.method) || 'Khác';

/**
 * Tiền khách đưa / tiền thừa: hoá đơn mới lưu riêng (cashTendered / changeDue); hoá đơn cũ ghi tiền khách đưa vào khoản
 * thu → phần khoản thu vượt số đã trả là tiền thừa (như phiếu hệ thống).
 */
function changeOf(receipt: ISalesOrderReceipt): { tendered: number; change: number } | null {
  if (receipt.invoice.isCancelled) return null;
  const { totals } = receipt;
  const changeDue = Math.round(totals.changeDue ?? 0);
  if (totals.cashTendered != null && changeDue > 0)
    return { tendered: totals.cashTendered, change: changeDue };
  const payments = receipt.payments ?? [];
  const tendered = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const change = Math.round(tendered - totals.paid);
  return payments.length > 0 && change > 0 && !(totals.remaining > 0) ? { tendered, change } : null;
}

/** Giá trị chữ của các trường không lặp (trường khối không có ở đây — xem receipt-template-render). */
export function receiptScalarValues(receipt: ISalesOrderReceipt): Record<string, string> {
  const { store, branch, invoice, totals, transferQr } = receipt;
  const lines = receipt.lines ?? [];
  const payments = receipt.payments ?? [];
  const cancelled = !!invoice.isCancelled;
  const storeName = clean(store?.name);
  const branchName = clean(branch?.name);
  const change = changeOf(receipt);
  const transfer = cancelled ? null : transferQr;
  const otherCharges = totals.total > totals.subTotal ? totals.total - totals.subTotal : 0;
  const totalQuantity = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);

  return {
    store_name: storeName,
    branch_name: branchName && branchName !== storeName ? branchName : '',
    store_address: clean(branch?.address) || clean(store?.address),
    store_phone: clean(branch?.phone) || clean(store?.phone),
    store_tax_code: clean(store?.taxCode),

    invoice_title: clean(receipt.title) || 'PHIẾU THANH TOÁN',
    invoice_code: clean(invoice.code),
    invoice_date: clean(invoice.createdAtLocal),
    cashier_name: clean(invoice.cashierName),
    customer_name: clean(invoice.customerName) || 'Khách lẻ',
    customer_phone: clean(invoice.customerPhone),
    invoice_note: clean(invoice.note),
    channel_name: CHANNEL_NAMES[clean(receipt.channel)] ?? '',
    printed_at: clean(receipt.printedAtLocal),

    subtotal: formatReceiptMoney(totals.subTotal),
    discount_total: totals.discountTotal > 0 ? formatReceiptMoney(-totals.discountTotal) : '',
    other_charges: moneyOrEmpty(otherCharges),
    total: formatReceiptMoney(totals.total),
    total_in_words: moneyInWords(totals.total),
    paid: formatReceiptMoney(totals.paid),
    cash_tendered: change ? formatReceiptMoney(change.tendered) : '',
    change_due: change ? formatReceiptMoney(change.change) : '',
    remaining: !cancelled && totals.remaining > 0 ? formatReceiptMoney(totals.remaining) : '',
    item_count: String(lines.length),
    total_quantity: formatReceiptQuantity(totalQuantity),

    payment_summary: Array.from(new Set(payments.map(paymentLabel))).join(', '),

    transfer_bank: clean(transfer?.bankName),
    transfer_account_number: clean(transfer?.accountNumber),
    transfer_account_name: clean(transfer?.accountName),
    transfer_amount: transfer ? formatReceiptMoney(transfer.amount) : '',
    transfer_content: clean(transfer?.content),

    footer: clean(receipt.footer),
  };
}

export function receiptItemValues(
  line: ISalesOrderReceiptLine,
  index: number
): Record<string, string> {
  const discount = Math.round(Number(line.discount) || 0);
  return {
    item_no: String(index + 1),
    item_name: clean(line.name) || 'Hàng hoá',
    item_code: clean(line.code),
    item_unit: clean(line.unit),
    item_quantity: formatReceiptQuantity(line.quantity),
    item_price: formatReceiptMoney(line.unitPrice),
    item_discount: discount !== 0 ? formatReceiptMoney(discount) : '',
    item_total: formatReceiptMoney(line.lineTotal),
    item_note: clean(line.note),
  };
}

export function receiptPaymentValues(payment: ISalesOrderReceiptPayment): Record<string, string> {
  return {
    payment_method: paymentLabel(payment),
    payment_amount: formatReceiptMoney(payment.amount),
    payment_reference: clean(payment.reference),
    payment_time: clean(payment.paidAtLocal),
  };
}
