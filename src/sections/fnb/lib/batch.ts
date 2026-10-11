import type { IFnbBatch, IFnbBatchRecipeLine, IFnbBatchRecipeItem, IFnbIngredientOption } from 'src/types/fnb';

// ----------------------------------------------------------------------
// Bán thành phẩm pha theo mẻ — tính xem trước giống máy chủ (FnbBatches.cs): nguyên liệu = công thức × số mẻ, sản lượng
// = sản lượng một mẻ × số mẻ, hạn = ngày pha + số ngày bảo quản, giá vốn một đơn vị = tổng giá vốn nguyên liệu / sản lượng.
// ----------------------------------------------------------------------

/** Nhân viên tự huỷ phiếu pha của mình trong 60 phút (máy chủ: FnbBatchRules.OwnCancelWindow). */
export const OWN_CANCEL_MINUTES = 60;

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** Nguyên liệu cho <count> mẻ theo công thức. */
export const scaleLines = (lines: readonly IFnbBatchRecipeLine[], count: number): IFnbBatchRecipeLine[] =>
  lines.map((l) => ({ ingredientId: l.ingredientId, quantity: round4(l.quantity * count) }));

/** Σ lượng × giá vốn; null khi không nguyên liệu nào có giá vốn (hoặc nhân viên — không có giá vốn). */
export function linesCost(
  lines: readonly IFnbBatchRecipeLine[],
  ingredients: ReadonlyMap<string, IFnbIngredientOption>
): number | null {
  if (!lines.some((l) => ingredients.get(l.ingredientId)?.unitCost != null)) return null;
  return Math.round(lines.reduce((sum, l) => sum + l.quantity * (ingredients.get(l.ingredientId)?.unitCost ?? 0), 0));
}

/** Lỗi nhập công thức mẻ (null = hợp lệ): nguyên liệu, lượng, trùng, sản lượng, số ngày bảo quản. */
export function batchRecipeError(
  productId: string,
  lines: readonly IFnbBatchRecipeLine[],
  yieldQuantity: number,
  shelfLifeDays: number | null
): string | null {
  if (lines.some((l) => !l.ingredientId)) return 'Chọn nguyên liệu cho mọi dòng.';
  if (lines.some((l) => l.ingredientId === productId)) return 'Bán thành phẩm không làm nguyên liệu của chính nó.';
  if (lines.some((l) => !(l.quantity > 0) || l.quantity > 1_000_000)) return 'Lượng phải lớn hơn 0.';
  if (new Set(lines.map((l) => l.ingredientId)).size !== lines.length) return 'Mỗi nguyên liệu chỉ khai một lần.';
  if (lines.length > 0 && (!(yieldQuantity > 0) || yieldQuantity > 1_000_000)) return 'Sản lượng một mẻ phải lớn hơn 0.';
  if (shelfLifeDays != null && (!Number.isInteger(shelfLifeDays) || shelfLifeDays < 0 || shelfLifeDays > 365))
    return 'Số ngày bảo quản từ 0 tới 365.';
  return null;
}

/** Ngày yyyy-MM-dd cộng thêm số ngày (theo lịch, không lệch múi giờ). */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Hạn mặc định của mẻ pha hôm nay; null khi công thức không ghi số ngày bảo quản. */
export const defaultExpiry = (item: Pick<IFnbBatchRecipeItem, 'shelfLifeDays'>, today: string) =>
  item.shelfLifeDays == null ? null : addDays(today, item.shelfLifeDays);

/** Người dùng huỷ được phiếu pha không: quản lý mọi phiếu chưa huỷ; nhân viên phiếu của mình trong 60 phút. */
export function canCancelBatch(
  batch: Pick<IFnbBatch, 'status' | 'createdById' | 'createdAt'>,
  userId: string | undefined,
  isManager: boolean,
  now: Date = new Date()
): boolean {
  if (batch.status !== 'Completed') return false;
  if (isManager) return true;
  return (
    !!userId &&
    batch.createdById === userId &&
    now.getTime() - new Date(batch.createdAt).getTime() <= OWN_CANCEL_MINUTES * 60_000
  );
}
