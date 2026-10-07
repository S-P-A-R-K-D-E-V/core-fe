import type { FnbServiceScope, IFnbRecipeLine, IFnbRecipeItem, IFnbIngredientOption } from 'src/types/fnb';

// ----------------------------------------------------------------------
// Định lượng (công thức) món F&B — tính giá vốn xem trước giống máy chủ (GetFnbRecipesQuery): dòng áp cho mọi hình
// thức phục vụ + đúng hình thức; nguyên liệu chưa có giá vốn tính 0; không dòng nào có giá vốn → null.
// ----------------------------------------------------------------------

export const SCOPE_LABEL: Record<FnbServiceScope, string> = {
  All: 'Mọi đơn',
  DineIn: 'Tại chỗ',
  Takeaway: 'Mang về',
};

export const applies = (scope: FnbServiceScope, takeaway: boolean) =>
  scope === 'All' || scope === (takeaway ? 'Takeaway' : 'DineIn');

export function recipeCost(
  lines: readonly IFnbRecipeLine[],
  ingredients: ReadonlyMap<string, IFnbIngredientOption>,
  takeaway: boolean
): number | null {
  const used = lines.filter((l) => applies(l.serviceScope, takeaway));
  if (!used.some((l) => ingredients.get(l.ingredientId)?.unitCost != null)) return null;
  return Math.round(used.reduce((sum, l) => sum + l.quantity * (ingredients.get(l.ingredientId)?.unitCost ?? 0), 0));
}

/** Tỷ lệ lãi gộp (0–100) trên giá bán; null khi chưa có giá vốn hoặc giá bán 0. */
export function marginPercent(price: number, cost: number | null): number | null {
  if (cost == null || price <= 0) return null;
  return Math.round(((price - cost) / price) * 100);
}

export const itemTitle = (item: Pick<IFnbRecipeItem, 'name' | 'variantName'>) =>
  item.variantName ? `${item.name} (${item.variantName})` : item.name;

/** Lỗi nhập trước khi gửi: thiếu nguyên liệu, lượng ≤ 0, trùng (nguyên liệu, hình thức). Trả null khi hợp lệ. */
export function recipeError(lines: readonly IFnbRecipeLine[]): string | null {
  if (lines.some((l) => !l.ingredientId)) return 'Chọn nguyên liệu cho mọi dòng.';
  if (lines.some((l) => !(l.quantity > 0) || l.quantity > 1_000_000)) return 'Lượng phải lớn hơn 0.';
  const keys = new Set<string>();
  for (const l of lines) {
    const key = `${l.ingredientId}|${l.serviceScope}`;
    if (keys.has(key)) return 'Một nguyên liệu chỉ khai một lần cho mỗi hình thức phục vụ.';
    keys.add(key);
  }
  return null;
}
