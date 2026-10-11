import type { IFnbForecastRow, FnbForecastStatus, FnbForecastConfidence } from 'src/types/fnb';

import { fQty } from './stock';

// ----------------------------------------------------------------------
// Dự báo nhập nguyên liệu — nhãn, chữ hiển thị và dòng phiếu nhập nháp từ gợi ý của máy chủ (FnbForecast.cs).
// ----------------------------------------------------------------------

export const FORECAST_STATUS: Record<
  FnbForecastStatus,
  { label: string; color: 'error' | 'warning' | 'info' | 'success' | 'default' }
> = {
  out: { label: 'Đã hết', color: 'error' },
  order: { label: 'Cần đặt ngay', color: 'error' },
  soon: { label: 'Sắp tới lúc đặt', color: 'warning' },
  ordered: { label: 'Đã đặt', color: 'info' },
  ok: { label: 'Đủ dùng', color: 'success' },
  idle: { label: 'Không dùng', color: 'default' },
};

export const CONFIDENCE_LABEL: Record<FnbForecastConfidence, string> = {
  low: 'thấp',
  medium: 'vừa',
  high: 'cao',
};

/** Vì sao nút "Phân tích AI" tắt — theo lý do máy chủ trả (AssistantUnavailableReasons). */
export function aiUnavailableText(reason: string | null): string {
  switch (reason) {
    case 'feature_off':
      return 'Gói của cửa hàng chưa có trợ lý AI (ai.assistant).';
    case 'role_not_allowed':
      return 'Chỉ chủ cửa hàng / quản lý dùng được phân tích AI.';
    case 'sign_in_required':
      return 'Phiên đăng nhập không thuộc cửa hàng này — đăng nhập lại.';
    default:
      return 'Trợ lý AI chưa được cấu hình trên máy chủ (thiếu khoá AI của trợ lý cửa hàng).';
  }
}

/** Trạng thái cần quản lý để ý (đặt hàng / đã đặt) hoặc có hàng sẽ hỏng. */
export const needsAttention = (row: IFnbForecastRow) =>
  row.status === 'out' || row.status === 'order' || row.status === 'soon' || row.status === 'ordered' || row.waste > 0;

/** "Đã hết", "~1,6 ngày", "—" (không dùng). */
export function daysLeftText(row: Pick<IFnbForecastRow, 'status' | 'daysLeft'>): string {
  if (row.status === 'out' || row.daysLeft === 0) return 'Đã hết';
  if (row.daysLeft == null) return '—';
  return `~${fQty(row.daysLeft)} ngày`;
}

const WEEKDAYS = [
  { index: 1, label: 'T2' },
  { index: 2, label: 'T3' },
  { index: 3, label: 'T4' },
  { index: 4, label: 'T5' },
  { index: 5, label: 'T6' },
  { index: 6, label: 'T7' },
  { index: 0, label: 'CN' },
];

/** "T2 500 · T3 500 · … · CN 600" (đơn vị gốc mỗi ngày). */
export const weekdayText = (row: Pick<IFnbForecastRow, 'weekday'>) =>
  WEEKDAYS.map((d) => `${d.label} ${fQty(Math.round(row.weekday[d.index] ?? 0))}`).join(' · ');

/** Xu hướng 7 ngày: "up" khi ≥ 1,5 lần, "down" khi ≤ 0,6 lần trung bình trước đó. */
export function trendOf(row: Pick<IFnbForecastRow, 'trend'>): 'up' | 'down' | null {
  if (row.trend == null) return null;
  if (row.trend >= 1.5) return 'up';
  if (row.trend <= 0.6) return 'down';
  return null;
}

export interface ForecastOrderDraft {
  productId: string;
  name: string;
  /** '' = chưa có nhà cung cấp (chọn trong hộp thoại). */
  supplierId: string;
  supplierName: string | null;
  quantity: number;
  unitId: string | null;
  unitName: string;
  unitPrice: number | null;
}

/** Dòng phiếu nhập nháp từ các dòng gợi ý đã chọn (bỏ bán thành phẩm pha tại quán và dòng không có gợi ý). */
export function draftLines(rows: readonly IFnbForecastRow[]): ForecastOrderDraft[] {
  return rows
    .filter((r) => !r.makeInHouse && r.purchase && r.purchase.quantity > 0)
    .map((r) => ({
      productId: r.id,
      name: r.name,
      supplierId: r.supplierId ?? '',
      supplierName: r.supplierName,
      quantity: r.purchase!.quantity,
      unitId: r.purchase!.unitId,
      unitName: r.purchase!.unitName ?? r.unit ?? '',
      unitPrice: r.purchase!.unitPrice,
    }));
}

/** Gom theo nhà cung cấp — mỗi nhóm thành một phiếu nhập nháp. */
export function groupBySupplier(lines: readonly ForecastOrderDraft[]): Map<string, ForecastOrderDraft[]> {
  const groups = new Map<string, ForecastOrderDraft[]>();
  lines.forEach((line) => {
    const list = groups.get(line.supplierId) ?? [];
    list.push(line);
    groups.set(line.supplierId, list);
  });
  return groups;
}
