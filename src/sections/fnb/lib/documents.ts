import type { FnbDocStatus, IFnbUnitOption, FnbDisposalReason } from 'src/types/fnb';

// ----------------------------------------------------------------------
// Phiếu xuất huỷ / phiếu kiểm kho F&B: nhãn, quy đổi đơn vị (khớp máy chủ: lượng × hệ số về đơn vị gốc).
// ----------------------------------------------------------------------

export const DOC_STATUS: Record<FnbDocStatus, { label: string; color: 'default' | 'warning' | 'success' | 'error' | 'info' }> = {
  Draft: { label: 'Đang đếm', color: 'info' },
  Pending: { label: 'Chờ duyệt', color: 'warning' },
  Completed: { label: 'Hoàn tất', color: 'success' },
  Cancelled: { label: 'Đã huỷ', color: 'default' },
};

export const DISPOSAL_REASONS: { value: FnbDisposalReason; label: string }[] = [
  { value: 'Expired', label: 'Quá hạn' },
  { value: 'Damaged', label: 'Hỏng' },
  { value: 'Spilled', label: 'Đổ vỡ' },
  { value: 'BadMake', label: 'Pha lỗi' },
  { value: 'Other', label: 'Khác' },
];

/** Ngưỡng giá trị phiếu xuất huỷ phải có ảnh (khớp FnbDisposalRules.PhotoThreshold). */
export const DISPOSAL_PHOTO_THRESHOLD = 200_000;

/** Hệ số của một đơn vị (null = đơn vị gốc → 1); không có → null. */
export function factorOf(units: readonly IFnbUnitOption[], unitId: string | null): number | null {
  if (!unitId) return 1;
  return units.find((u) => u.unitId === unitId)?.factor ?? null;
}

/** Tổng theo đơn vị gốc của các phần (vd 2 hộp + 150 ml). Phần có đơn vị lạ bị bỏ qua. */
export function baseQuantity(
  units: readonly IFnbUnitOption[],
  parts: readonly { unitId: string | null; quantity: number }[]
): number {
  return parts.reduce((sum, p) => sum + (factorOf(units, p.unitId) ?? 0) * (Number.isFinite(p.quantity) ? p.quantity : 0), 0);
}

/**
 * Ô nhập số đếm của một dòng → các phần gửi lên: đơn vị mua lớn nhất (nếu có) + đơn vị gốc. Ô trống bỏ qua; cả hai trống
 * = chưa đếm (null); số âm / không phải số → lỗi (undefined).
 */
export function countParts(
  bigUnit: IFnbUnitOption | null,
  bigValue: string,
  baseValue: string
): { unitId: string | null; quantity: number }[] | null | undefined {
  const parts: { unitId: string | null; quantity: number }[] = [];
  const read = (value: string) => {
    const text = value.trim().replace(',', '.');
    if (text === '') return null;
    const n = Number(text);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  const big = bigUnit ? read(bigValue) : null;
  const base = read(baseValue);
  if (big === undefined || base === undefined) return undefined;
  if (big !== null && bigUnit) parts.push({ unitId: bigUnit.unitId, quantity: big });
  if (base !== null) parts.push({ unitId: null, quantity: base });
  return parts.length === 0 ? null : parts;
}

/** Đơn vị mua lớn nhất của nguyên liệu (dùng cho ô nhập thứ nhất); không có → null. */
export const biggestUnit = (units: readonly IFnbUnitOption[]) =>
  units.length === 0 ? null : [...units].sort((a, b) => b.factor - a.factor)[0];
