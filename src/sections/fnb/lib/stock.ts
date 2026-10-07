import type { FnbStockReason, FnbStockStatus, IFnbStockIngredient } from 'src/types/fnb';

// ----------------------------------------------------------------------
// Kho nguyên liệu F&B: nhãn, sắp xếp, và dòng kiểm kê gửi lên (chỉ dòng đã nhập số đếm KHÁC tồn hệ thống).
// ----------------------------------------------------------------------

export const STATUS_LABEL: Record<FnbStockStatus, { label: string; color: 'error' | 'warning' | 'success' | 'default' }> = {
  out: { label: 'Hết', color: 'error' },
  low: { label: 'Sắp hết', color: 'warning' },
  ok: { label: 'Đủ dùng', color: 'success' },
  idle: { label: 'Chưa dùng', color: 'default' },
};

export const REASON_LABEL: Record<Exclude<FnbStockReason, 'Count'>, string> = {
  Expired: 'Quá hạn',
  Damaged: 'Hỏng / đổ vỡ',
  Other: 'Khác',
};

const STATUS_ORDER: Record<FnbStockStatus, number> = { out: 0, low: 1, ok: 2, idle: 3 };

/** Hết → sắp hết → đủ → chưa dùng; trong nhóm: ít ngày còn lại trước, rồi theo tên. */
export function sortIngredients(list: readonly IFnbStockIngredient[]): IFnbStockIngredient[] {
  return [...list].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      (a.daysLeft ?? Number.MAX_VALUE) - (b.daysLeft ?? Number.MAX_VALUE) ||
      a.name.localeCompare(b.name, 'vi')
  );
}

/** Số hiển thị: tối đa 3 chữ số lẻ, phân tách kiểu Việt Nam. */
export const fQty = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 3 });

/** Dòng kiểm kê: ô đã nhập (số hợp lệ ≥ 0) và khác tồn hệ thống. */
export function countLines(
  ingredients: readonly IFnbStockIngredient[],
  counted: Readonly<Record<string, string>>
): { productId: string; quantity: number }[] {
  return ingredients
    .filter((i) => (counted[i.id] ?? '').trim() !== '')
    .map((i) => ({ productId: i.id, quantity: Number(counted[i.id]), onHand: i.onHand }))
    .filter((l) => Number.isFinite(l.quantity) && l.quantity >= 0 && Math.abs(l.quantity - l.onHand) > 1e-9)
    .map(({ productId, quantity }) => ({ productId, quantity }));
}
