import type { IFnbComboBook, IFnbComboItem, IFnbComboGroupInput } from 'src/types/fnb';

// ----------------------------------------------------------------------
// Khai combo: nhóm thành phần đang soạn, kiểm tra trước khi lưu, so giá combo với mua lẻ.
// ----------------------------------------------------------------------

export const MAX_COMBO_GROUPS = 10;
export const MAX_COMBO_OPTIONS = 20;
export const MAX_COMBO_GROUP_NAME = 100;
export const MAX_COMBO_OPTION_QTY = 20;

/** Một lựa chọn đang soạn; số lượng / phụ thu để dạng chữ cho ô nhập. */
export type ComboOptionDraft = { productId: string; quantity: string; surcharge: string };

export type ComboGroupDraft = { name: string; options: ComboOptionDraft[] };

export const emptyOption = (): ComboOptionDraft => ({ productId: '', quantity: '1', surcharge: '0' });

export const emptyGroup = (): ComboGroupDraft => ({ name: '', options: [emptyOption()] });

/** Nhóm đang soạn từ combo đã lưu (combo mới: một nhóm trống). */
export function groupDrafts(combo: IFnbComboItem | null): ComboGroupDraft[] {
  if (!combo || combo.groups.length === 0) return [emptyGroup()];
  return combo.groups.map((g) => ({
    name: g.name,
    options: g.options.map((o) => ({
      productId: o.productId,
      quantity: String(o.quantity),
      surcharge: String(o.surcharge),
    })),
  }));
}

const isWhole = (text: string, min: number, max: number) => {
  const n = Number(text);
  return text.trim() !== '' && Number.isInteger(n) && n >= min && n <= max;
};

/** Lỗi đầu tiên của các nhóm đang soạn; null = lưu được. Cùng luật với máy chủ. */
export function comboGroupsError(groups: readonly ComboGroupDraft[]): string | null {
  if (groups.length === 0) return 'Combo cần ít nhất một nhóm.';
  if (groups.length > MAX_COMBO_GROUPS) return `Combo có tối đa ${MAX_COMBO_GROUPS} nhóm.`;

  for (let i = 0; i < groups.length; i += 1) {
    const group = groups[i];
    const label = group.name.trim() || `Nhóm ${i + 1}`;
    if (!group.name.trim()) return `Nhóm ${i + 1} chưa có tên.`;
    if (group.name.trim().length > MAX_COMBO_GROUP_NAME) return `Tên nhóm "${label}" quá dài.`;
    if (group.options.length === 0) return `Nhóm "${label}" chưa có lựa chọn.`;
    if (group.options.length > MAX_COMBO_OPTIONS) return `Nhóm "${label}" có tối đa ${MAX_COMBO_OPTIONS} lựa chọn.`;
    if (group.options.some((o) => !o.productId)) return `Nhóm "${label}" có lựa chọn chưa chọn món.`;
    if (new Set(group.options.map((o) => o.productId)).size !== group.options.length)
      return `Nhóm "${label}" có món bị chọn hai lần.`;
    if (group.options.some((o) => !isWhole(o.quantity, 1, MAX_COMBO_OPTION_QTY)))
      return `Nhóm "${label}": số lượng phải từ 1 đến ${MAX_COMBO_OPTION_QTY}.`;
    if (group.options.some((o) => !isWhole(o.surcharge, 0, 999_999_999)))
      return `Nhóm "${label}": phụ thu phải là số tiền không âm.`;
  }

  return null;
}

/** Dữ liệu gửi PUT /fnb/menu/combos/{productId}. */
export function toGroupInputs(groups: readonly ComboGroupDraft[]): IFnbComboGroupInput[] {
  return groups.map((g) => ({
    name: g.name.trim(),
    options: g.options.map((o) => ({
      productId: o.productId,
      quantity: Number(o.quantity),
      surcharge: Number(o.surcharge),
    })),
  }));
}

/** Tên một dòng bán được: "Cà phê sữa (L)". */
export const choiceLabel = (c: { name: string; variantName: string | null }) =>
  c.variantName ? `${c.name} (${c.variantName})` : c.name;

/** Tổng giá mua lẻ của các lựa chọn mặc định (lựa chọn đầu của mỗi nhóm) theo giá thực đơn hiện tại. */
export function draftComponentsPrice(groups: readonly ComboGroupDraft[], choices: IFnbComboBook['choices']): number {
  const priceById = new Map(choices.map((c) => [c.productId, c.price]));
  return groups.reduce((sum, g) => {
    const first = g.options[0];
    if (!first?.productId) return sum;
    return sum + (priceById.get(first.productId) ?? 0) * (Number(first.quantity) || 0);
  }, 0);
}

/** Combo rẻ hơn mua lẻ bao nhiêu (âm = combo đắt hơn mua lẻ). */
export const comboSaving = (combo: Pick<IFnbComboItem, 'price' | 'componentsPrice'>) =>
  combo.componentsPrice - combo.price;
