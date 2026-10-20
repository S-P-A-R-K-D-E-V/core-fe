import { apiErrorMessage, hasApiErrorCode } from 'src/utils/api-error';

import type {
  IPurchaseImport,
  IPurchaseImportLine,
  PurchaseImportStatus,
  PurchaseImportLineStatus,
} from 'src/types/purchase-import';

// ----------------------------------------------------------------------
// Nhập phiếu từ ảnh hoá đơn — nhãn, màu và điều kiện chốt phiếu (khớp CommitPurchaseImportCommandHandler ở Core-be).
// ----------------------------------------------------------------------

type LabelColor = 'default' | 'info' | 'warning' | 'success' | 'error' | 'primary' | 'secondary';

export const IMPORT_STATUS: Record<PurchaseImportStatus, { label: string; color: LabelColor }> = {
  Extracting: { label: 'Đang đọc ảnh', color: 'info' },
  NeedsReview: { label: 'Chờ duyệt', color: 'warning' },
  Committed: { label: 'Đã tạo phiếu', color: 'success' },
  Failed: { label: 'Đọc lỗi', color: 'error' },
  Cancelled: { label: 'Đã huỷ', color: 'default' },
};

export const LINE_STATUS: Record<PurchaseImportLineStatus, { label: string; color: LabelColor }> = {
  Matched: { label: 'Tự khớp', color: 'success' },
  Resolved: { label: 'Đã chọn', color: 'primary' },
  Suggested: { label: 'Cần chọn', color: 'warning' },
  Unknown: { label: 'Chưa có mã', color: 'error' },
  Skipped: { label: 'Bỏ', color: 'default' },
};

const ISSUE_LABELS: Record<string, string> = {
  number_mismatch: 'SL × giá ≠ thành tiền — kiểm lại số',
  number_corrected: 'Đã chọn cách đọc số khớp phép nhân',
  ambiguous_reading: 'Chữ số không rõ (vd 2 × 80 hay 20 × 8)',
  missing_numbers: 'Thiếu số lượng / tiền',
  unit_converted: 'Đã đổi tá / lố / chục ra cái',
  pack_guess: 'Giá có thể theo tá / chục — kiểm số lượng',
};

export function issueLabel(code: string): string {
  return ISSUE_LABELS[code] ?? code;
}

/** Vấn đề về số cần người duyệt nhìn (đổi đơn vị chỉ là thông tin). */
export function hasNumberIssue(line: IPurchaseImportLine): boolean {
  return line.issues.some((i) => i !== 'unit_converted' && i !== 'number_corrected');
}

/** Thành tiền dòng: số trên hoá đơn, không có thì SL × đơn giá. */
export function lineTotalOf(line: IPurchaseImportLine): number | null {
  if (line.lineTotal != null && line.lineTotal > 0) return line.lineTotal;
  return line.quantity && line.unitPrice ? Math.round(line.quantity * line.unitPrice * 100) / 100 : null;
}

/** Giá nhập mỗi cái khi đã đếm số cái của gói (thành tiền / số cái); chưa đếm → null. */
export function perPieceCost(line: IPurchaseImportLine, counted = line.countedQuantity): number | null {
  const total = lineTotalOf(line);
  return counted && counted > 0 && total ? Math.round((total / counted) * 100) / 100 : null;
}

/** Giá mỗi chiếc vô lý (< 100đ) — thường do gõ nhầm giá vào ô số chiếc. */
export function implausiblePieceCost(cost: number | null | undefined): boolean {
  return cost != null && cost > 0 && cost < 100;
}

/** Giá nhập đưa vào phiếu cho mỗi đơn vị (đã đếm thì mỗi cái). */
export function receiptUnitCost(line: IPurchaseImportLine): number | null {
  return perPieceCost(line) ?? line.unitPrice ?? (line.lineTotal && line.quantity ? line.lineTotal / line.quantity : null);
}

/** Giá bán gợi ý cho mã mới khi người duyệt bỏ trống: gấp đôi giá nhập, làm tròn lên nghìn (khớp Core-be). */
export function suggestSalePrice(cost: number | null | undefined): number | null {
  return cost && cost > 0 ? Math.ceil((cost * 2) / 1000) * 1000 : null;
}

/** Dòng còn phải quyết: chưa có mã (mã có sẵn hoặc tên mã mới) hoặc thiếu số (dòng bỏ không tính). */
export function isLinePending(line: IPurchaseImportLine): boolean {
  if (line.status === 'Skipped') return false;
  return !(line.productId || line.newProductName) || !(line.quantity && line.quantity > 0) || !((line.unitPrice ?? 0) > 0 || (line.lineTotal ?? 0) > 0);
}

/** Lý do chưa tạo được phiếu — rỗng là tạo được. */
export function commitBlockers(item: IPurchaseImport): string[] {
  const reasons: string[] = [];
  if (item.status !== 'NeedsReview') return ['Hoá đơn không còn ở bước duyệt.'];
  if (!item.supplierId) reasons.push('Chọn nhà cung cấp.');
  const active = item.lines.filter((l) => l.status !== 'Skipped');
  if (active.length === 0) reasons.push('Mọi dòng đều bị bỏ.');
  const pending = active.filter(isLinePending).length;
  if (pending > 0) reasons.push(`Còn ${pending} dòng chưa chọn mã hoặc thiếu số.`);
  return reasons;
}

/** Tổng hoá đơn lệch tổng các dòng (≥ 1.000đ hoặc 0,1%). */
export function totalMismatch(item: IPurchaseImport): number | null {
  if (!item.invoiceTotal) return null;
  const diff = item.linesTotal - item.invoiceTotal;
  return Math.abs(diff) > Math.max(item.invoiceTotal * 0.001, 1000) ? diff : null;
}

export function lineCounts(item: IPurchaseImport) {
  const count = (s: PurchaseImportLineStatus) => item.lines.filter((l) => l.status === s).length;
  return {
    matched: count('Matched') + count('Resolved'),
    pending: item.lines.filter(isLinePending).length,
    skipped: count('Skipped'),
  };
}

/** Tải ảnh / tạo lần nhập trả { error, code }; các bước sau trả Problem của ErrorOr. */
export function importErrorMessage(err: any, fallback: string): string {
  if (err && typeof err === 'object' && typeof err.error === 'string' && err.error) return err.error;
  return apiErrorMessage(err, fallback);
}

/** Hoá đơn này đã tạo phiếu trước đó — cho người duyệt chọn tạo tiếp. */
export function isDuplicateInvoice(err: any): boolean {
  return hasApiErrorCode(err, 'PurchaseImport.DuplicateInvoice');
}

/** Số người duyệt gõ: "1.170.000", "1 170 000", "16687,5", "16687.5" → số dương; còn lại null. */
export function parseAmount(text: string): number | null {
  const t = text.replace(/\s/g, '');
  if (!t) return null;
  const grouped = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t);
  const n = Number(grouped ? t.replace(/\./g, '').replace(',', '.') : t.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}
