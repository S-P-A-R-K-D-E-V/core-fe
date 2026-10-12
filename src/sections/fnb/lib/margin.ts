import type { IFnbDishMarginRow, FnbDishMarginKind } from 'src/types/fnb';

// ----------------------------------------------------------------------
// Lãi gộp theo món: nhãn loại, lọc, sắp xếp, tô màu tỷ lệ.
// ----------------------------------------------------------------------

export const MARGIN_KIND_LABELS: Record<FnbDishMarginKind, string> = {
  dish: 'Món',
  topping: 'Món thêm',
  goods: 'Hàng bán thẳng',
};

/** 'uncosted' = mặt hàng có dòng bán ra chưa có giá vốn. */
export type MarginFilter = 'all' | FnbDishMarginKind | 'uncosted';

export const MARGIN_FILTERS: { value: MarginFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'dish', label: 'Món' },
  { value: 'topping', label: 'Món thêm' },
  { value: 'goods', label: 'Hàng bán thẳng' },
  { value: 'uncosted', label: 'Chưa có giá vốn' },
];

/** Tỷ lệ lãi gộp dưới mức này (giá vốn quá nửa giá bán) được tô vàng. */
export const LOW_MARGIN_RATE = 0.5;

export function marginTone(rate: number | null): 'default' | 'warning' | 'error' {
  if (rate == null) return 'default';
  if (rate < 0) return 'error';
  return rate < LOW_MARGIN_RATE ? 'warning' : 'default';
}

export const fPercent = (rate: number | null) =>
  rate == null ? '—' : `${(rate * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;

export function filterMarginRows(rows: readonly IFnbDishMarginRow[], filter: MarginFilter): IFnbDishMarginRow[] {
  if (filter === 'all') return [...rows];
  if (filter === 'uncosted') return rows.filter((r) => r.uncostedQuantity > 0);
  return rows.filter((r) => r.kind === filter);
}

export type MarginSortKey = 'name' | 'quantity' | 'revenue' | 'cost' | 'profit' | 'marginRate';

/** Sắp theo cột; dòng chưa có tỷ lệ (null) luôn nằm cuối; bằng nhau thì theo tên. */
export function sortMarginRows(
  rows: readonly IFnbDishMarginRow[],
  key: MarginSortKey,
  direction: 'asc' | 'desc'
): IFnbDishMarginRow[] {
  const sign = direction === 'asc' ? 1 : -1;
  const byName = (a: IFnbDishMarginRow, b: IFnbDishMarginRow) => a.name.localeCompare(b.name, 'vi');

  return [...rows].sort((a, b) => {
    if (key === 'name') return sign * byName(a, b);

    const [x, y] = [a[key], b[key]];
    if (x == null || y == null) {
      if (x == null && y == null) return byName(a, b);
      return x == null ? 1 : -1;
    }
    return x === y ? byName(a, b) : sign * (x - y);
  });
}
