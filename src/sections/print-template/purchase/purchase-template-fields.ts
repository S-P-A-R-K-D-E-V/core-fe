import type { IPurchaseOrderPrint, IPurchaseOrderPrintLine } from 'src/types/purchase-print';

import { moneyInWords } from '../money-words';
import { storeScalarValues } from '../receipt/receipt-template-fields';
import { formatReceiptMoney, formatReceiptQuantity } from '../../pos/receipt-print/receipt-html';

import type { PrintDocument } from '../print-document';
import type { PrintFieldDef, PrintFieldSet } from '../receipt/receipt-template-fields';

// ----------------------------------------------------------------------
// Trường trộn của mẫu phiếu nhập hàng (GET /purchase-orders/{id}/print). Dùng lại tên trường của hoá đơn khi cùng nghĩa
// (đầu cửa hàng, `item_*`, tổng tiền hàng, tiêu đề, mã vạch / QR mã phiếu) để khối dùng chung dịch ra cùng một HTML.
// `invoice_code` = mã phiếu nhập (khối mã vạch dùng nó); `purchase_code` là tên rõ nghĩa hơn cho chữ tự do.
// ----------------------------------------------------------------------

export type PurchaseFieldGroup = 'store' | 'purchase' | 'supplier' | 'item' | 'total' | 'code';

export const PURCHASE_FIELD_GROUPS: { key: PurchaseFieldGroup; label: string; hint?: string }[] = [
  { key: 'store', label: 'Cửa hàng' },
  { key: 'purchase', label: 'Phiếu nhập' },
  { key: 'supplier', label: 'Nhà cung cấp' },
  { key: 'item', label: 'Dòng hàng', hint: 'Đoạn / hàng bảng chứa trường này được lặp cho từng dòng.' },
  { key: 'total', label: 'Tổng tiền' },
  { key: 'code', label: 'Mã vạch / QR mã phiếu' },
];

export const PURCHASE_FIELDS: PrintFieldDef<PurchaseFieldGroup>[] = [
  { key: 'store_name', label: 'Tên cửa hàng', group: 'store' },
  { key: 'branch_name', label: 'Chi nhánh nhập', group: 'store', hint: 'Trống khi trùng tên cửa hàng' },
  { key: 'store_address', label: 'Địa chỉ', group: 'store', hint: 'Của chi nhánh nếu có' },
  { key: 'store_phone', label: 'Điện thoại', group: 'store' },
  { key: 'store_tax_code', label: 'Mã số thuế', group: 'store' },

  { key: 'invoice_title', label: 'Tiêu đề phiếu', group: 'purchase' },
  { key: 'purchase_code', label: 'Mã phiếu nhập', group: 'purchase' },
  { key: 'purchase_date', label: 'Ngày nhập', group: 'purchase' },
  { key: 'purchase_status', label: 'Trạng thái', group: 'purchase' },
  { key: 'warehouse_name', label: 'Kho nhập', group: 'purchase' },
  { key: 'created_by', label: 'Người nhập', group: 'purchase' },
  { key: 'purchase_note', label: 'Ghi chú phiếu', group: 'purchase' },
  { key: 'printed_at', label: 'Thời điểm in', group: 'purchase' },
  {
    key: 'cancelled_banner',
    label: 'Dấu "ĐÃ HUỶ"',
    group: 'purchase',
    block: true,
    hint: 'Chỉ hiện khi phiếu đã huỷ',
  },

  { key: 'supplier_name', label: 'Nhà cung cấp', group: 'supplier' },
  { key: 'supplier_code', label: 'Mã NCC', group: 'supplier' },
  { key: 'supplier_phone', label: 'SĐT NCC', group: 'supplier' },
  { key: 'supplier_address', label: 'Địa chỉ NCC', group: 'supplier' },

  { key: 'item_no', label: 'STT', group: 'item' },
  { key: 'item_name', label: 'Tên hàng', group: 'item' },
  { key: 'item_code', label: 'Mã hàng', group: 'item' },
  { key: 'item_unit', label: 'Đơn vị nhập', group: 'item' },
  { key: 'item_quantity', label: 'Số lượng', group: 'item' },
  { key: 'item_price', label: 'Đơn giá nhập', group: 'item' },
  { key: 'item_discount', label: 'Giảm giá dòng', group: 'item', hint: 'Trống khi không giảm' },
  { key: 'item_total', label: 'Thành tiền', group: 'item' },
  { key: 'item_note', label: 'Ghi chú dòng', group: 'item' },

  { key: 'subtotal', label: 'Tổng tiền hàng', group: 'total' },
  { key: 'discount_total', label: 'Giảm giá phiếu', group: 'total', hint: 'Trống khi 0' },
  { key: 'vat_total', label: 'Thuế VAT', group: 'total', hint: 'Trống khi 0' },
  { key: 'total', label: 'Cần trả NCC', group: 'total' },
  { key: 'total_in_words', label: 'Cần trả NCC (bằng chữ)', group: 'total' },
  { key: 'paid_to_supplier', label: 'Đã trả NCC', group: 'total' },
  { key: 'supplier_debt', label: 'Còn nợ NCC', group: 'total', hint: 'Trống khi đã trả đủ' },
  { key: 'item_count', label: 'Số mặt hàng', group: 'total' },
  { key: 'total_quantity', label: 'Tổng số lượng', group: 'total' },

  { key: 'invoice_barcode', label: 'Mã vạch mã phiếu', group: 'code', block: true },
  { key: 'invoice_qr', label: 'Mã QR mã phiếu', group: 'code', block: true },
];

export const PURCHASE_FIELD_SET: PrintFieldSet = {
  groups: PURCHASE_FIELD_GROUPS,
  fields: PURCHASE_FIELDS,
};

// ── Giá trị ───────────────────────────────────────────────────────────────

const clean = (text: string | null | undefined) => (text ?? '').trim();

const moneyOrEmpty = (amount: number | null | undefined) =>
  amount !== null && amount !== undefined && Math.round(amount) !== 0 ? formatReceiptMoney(amount) : '';

export function purchaseItemValues(line: IPurchaseOrderPrintLine, index: number): Record<string, string> {
  return {
    item_no: String(index + 1),
    item_name: clean(line.name) || 'Hàng hoá',
    item_code: clean(line.code),
    item_unit: clean(line.unit),
    item_quantity: formatReceiptQuantity(line.quantity),
    item_price: formatReceiptMoney(line.unitPrice),
    item_discount: moneyOrEmpty(line.discount),
    item_total: formatReceiptMoney(line.lineTotal),
    item_note: clean(line.note),
  };
}

/** Phiếu nhập (GET /purchase-orders/{id}/print) → chứng từ chung để trộn vào mẫu. */
export function purchaseDocument(print: IPurchaseOrderPrint): PrintDocument {
  const { purchase, totals } = print;
  const lines = print.lines ?? [];
  const code = clean(purchase.code);
  const totalQuantity = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
  const scalars: Record<string, string> = {
    ...storeScalarValues(print.store, print.branch),

    invoice_title: clean(print.title) || 'PHIẾU NHẬP HÀNG',
    invoice_code: code,
    purchase_code: code,
    purchase_date: clean(purchase.dateLocal),
    purchase_status: clean(purchase.statusLabel),
    warehouse_name: clean(purchase.warehouseName),
    created_by: clean(purchase.createdByName),
    purchase_note: clean(purchase.note),
    printed_at: clean(print.printedAtLocal),

    supplier_name: clean(purchase.supplierName),
    supplier_code: clean(purchase.supplierCode),
    supplier_phone: clean(purchase.supplierPhone),
    supplier_address: clean(purchase.supplierAddress),

    subtotal: formatReceiptMoney(totals.subTotal),
    discount_total: totals.discount > 0 ? formatReceiptMoney(-totals.discount) : '',
    vat_total: moneyOrEmpty(totals.vat),
    total: formatReceiptMoney(totals.total),
    total_in_words: moneyInWords(totals.total),
    paid_to_supplier: formatReceiptMoney(totals.paid),
    supplier_debt: !purchase.isCancelled && totals.remaining > 0 ? formatReceiptMoney(totals.remaining) : '',
    item_count: String(lines.length),
    total_quantity: formatReceiptQuantity(totalQuantity),
  };
  return {
    title: `Phiếu nhập ${code}`.trim(),
    code,
    cancelled: !!purchase.isCancelled,
    logoUrl: print.store?.logoUrl ?? null,
    scalars,
    items: lines.map(purchaseItemValues),
    payments: [],
    transferQrPayload: null,
  };
}

/** Phiếu nhập mẫu để xem trước / in thử khi chưa chọn phiếu thật. */
export function samplePurchasePrint(
  storeName = 'Cửa hàng của bạn',
  logoUrl: string | null = null
): IPurchaseOrderPrint {
  return {
    title: 'PHIẾU NHẬP HÀNG',
    store: { name: storeName, address: '21 Chùa Láng, Đống Đa, Hà Nội', phone: '0901 234 567', taxCode: null, logoUrl },
    branch: null,
    purchase: {
      id: 'sample',
      code: 'PN000123',
      dateUtc: '2026-11-14T03:00:00Z',
      dateLocal: '14/11/2026 10:00',
      timezone: 'Asia/Ho_Chi_Minh',
      supplierName: 'Xưởng phụ kiện Minh Anh',
      supplierCode: 'NCC001',
      supplierPhone: '0912 345 678',
      supplierAddress: '12 Hàng Bạc, Hoàn Kiếm',
      warehouseName: 'Kho chính',
      createdByName: 'Nguyễn Văn A',
      note: 'Giao đủ, kiểm đếm tại cửa hàng',
      status: 'Completed',
      statusLabel: 'Đã nhập hàng',
      isCancelled: false,
    },
    lines: [
      { lineNo: 1, name: 'Kẹp tóc nơ nhung đỏ', code: 'K35', unit: 'Hộp 12 cái', quantity: 5, unitPrice: 180000, discount: 0, vatRate: 0, lineTotal: 900000, note: null },
      { lineNo: 2, name: 'Bông tai bạc đính đá', code: 'BT120', unit: 'Đôi', quantity: 20, unitPrice: 65000, discount: 50000, vatRate: 0, lineTotal: 1250000, note: 'Hàng tặng kèm 2 đôi' },
      { lineNo: 3, name: 'Túi giấy in logo', code: 'TG01', unit: 'Cái', quantity: 200, unitPrice: 1500, discount: 0, vatRate: 0, lineTotal: 300000, note: null },
    ],
    totals: { subTotal: 2450000, discount: 50000, vat: 0, total: 2400000, paid: 1000000, remaining: 1400000 },
    printedAtLocal: '14/11/2026 10:05',
  };
}
