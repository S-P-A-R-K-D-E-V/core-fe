import type { IFnbRecipeLine, IFnbStockIngredient, IFnbIngredientOption } from 'src/types/fnb';

import { describe, expect, it } from 'vitest';

import { sortIngredients } from '../lib/stock';
import { recipeCost, recipeError, marginPercent } from '../lib/recipe';

// ----------------------------------------------------------------------

const option = (id: string, unitCost: number | null): IFnbIngredientOption => ({
  id,
  code: id,
  name: id,
  unit: 'g',
  kind: 'Ingredient',
  unitCost,
  onHand: 0,
});

const ingredients = new Map([
  ['bean', option('bean', 300)],
  ['milk', option('milk', 60)],
  ['cup', option('cup', 800)],
  ['ice', option('ice', null)],
]);

const line = (ingredientId: string, quantity: number, serviceScope: IFnbRecipeLine['serviceScope'] = 'All') => ({
  ingredientId,
  quantity,
  serviceScope,
});

describe('định lượng', () => {
  it('giá vốn theo hình thức phục vụ — bao bì chỉ tính khi mang về', () => {
    const lines = [line('bean', 25), line('milk', 40), line('cup', 1, 'Takeaway'), line('ice', 100)];
    expect(recipeCost(lines, ingredients, false)).toBe(25 * 300 + 40 * 60);
    expect(recipeCost(lines, ingredients, true)).toBe(25 * 300 + 40 * 60 + 800);
  });

  it('không nguyên liệu nào có giá vốn → null', () => {
    expect(recipeCost([line('ice', 100)], ingredients, false)).toBeNull();
    expect(recipeCost([], ingredients, false)).toBeNull();
  });

  it('lãi gộp trên giá bán', () => {
    expect(marginPercent(35_000, 9_900)).toBe(72);
    expect(marginPercent(35_000, null)).toBeNull();
  });

  it('bắt lỗi nhập: thiếu nguyên liệu, lượng ≤ 0, trùng cùng hình thức', () => {
    expect(recipeError([line('', 1)])).toMatch(/Chọn nguyên liệu/);
    expect(recipeError([line('bean', 0)])).toMatch(/lớn hơn 0/);
    expect(recipeError([line('bean', 1), line('bean', 2)])).toMatch(/một lần/);
    expect(recipeError([line('cup', 1, 'Takeaway'), line('cup', 1, 'DineIn')])).toBeNull();
  });
});

const stock = (id: string, p: Partial<IFnbStockIngredient>): IFnbStockIngredient => ({
  id,
  code: id,
  name: id,
  unit: 'g',
  kind: 'Ingredient',
  onHand: 100,
  unitCost: 1,
  value: 100,
  used: 0,
  daysLeft: null,
  usedInDishes: 1,
  status: 'ok',
  units: [],
  ...p,
});

describe('kho nguyên liệu', () => {
  it('xếp hết → sắp hết → đủ → chưa dùng, ít ngày trước', () => {
    const sorted = sortIngredients([
      stock('idle', { status: 'idle' }),
      stock('ok-5', { status: 'ok', daysLeft: 5 }),
      stock('ok-3', { status: 'ok', daysLeft: 3 }),
      stock('out', { status: 'out' }),
      stock('low', { status: 'low', daysLeft: 1 }),
    ]);
    expect(sorted.map((s) => s.id)).toEqual(['out', 'low', 'ok-3', 'ok-5', 'idle']);
  });

});
