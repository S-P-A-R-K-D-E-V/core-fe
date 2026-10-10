import type { FnbStockStatus, IFnbStockIngredient } from 'src/types/fnb';

// ----------------------------------------------------------------------
// Kho nguyên liệu F&B: nhãn trạng thái, sắp xếp, định dạng số.
// ----------------------------------------------------------------------

export const STATUS_LABEL: Record<FnbStockStatus, { label: string; color: 'error' | 'warning' | 'success' | 'default' }> = {
  out: { label: 'Hết', color: 'error' },
  low: { label: 'Sắp hết', color: 'warning' },
  ok: { label: 'Đủ dùng', color: 'success' },
  idle: { label: 'Chưa dùng', color: 'default' },
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
