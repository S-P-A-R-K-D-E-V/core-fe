import type { IFnbIngredientOption } from 'src/types/fnb';

import { describe, expect, it } from 'vitest';

import { addDays, linesCost, scaleLines, defaultExpiry, canCancelBatch, batchRecipeError } from '../lib/batch';

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
  ['bean', option('bean', 400)],
  ['water', option('water', null)],
]);

describe('pha mẻ bán thành phẩm', () => {
  it('nhân công thức theo số mẻ (làm tròn 4 chữ số)', () => {
    expect(scaleLines([{ ingredientId: 'bean', quantity: 250 }, { ingredientId: 'water', quantity: 0.12345 }], 1.5)).toEqual([
      { ingredientId: 'bean', quantity: 375 },
      { ingredientId: 'water', quantity: 0.1852 },
    ]);
  });

  it('giá vốn nguyên liệu: chưa có giá vốn tính 0, không dòng nào có giá vốn → null', () => {
    expect(linesCost([{ ingredientId: 'bean', quantity: 250 }, { ingredientId: 'water', quantity: 2000 }], ingredients)).toBe(100_000);
    expect(linesCost([{ ingredientId: 'water', quantity: 2000 }], ingredients)).toBeNull();
  });

  it('kiểm tra công thức mẻ', () => {
    const ok = [{ ingredientId: 'bean', quantity: 250 }];
    expect(batchRecipeError('brew', ok, 1800, 3)).toBeNull();
    expect(batchRecipeError('brew', [], 0, null)).toBeNull(); // bỏ công thức
    expect(batchRecipeError('brew', [{ ingredientId: '', quantity: 1 }], 1800, 3)).toMatch(/Chọn nguyên liệu/);
    expect(batchRecipeError('brew', [{ ingredientId: 'brew', quantity: 1 }], 1800, 3)).toMatch(/chính nó/);
    expect(batchRecipeError('brew', [...ok, ...ok], 1800, 3)).toMatch(/một lần/);
    expect(batchRecipeError('brew', ok, 0, 3)).toMatch(/Sản lượng/);
    expect(batchRecipeError('brew', ok, 1800, 400)).toMatch(/bảo quản/);
    expect(batchRecipeError('brew', ok, 1800, 1.5)).toMatch(/bảo quản/);
  });

  it('hạn mặc định = hôm nay + số ngày bảo quản, qua tháng / năm', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(defaultExpiry({ shelfLifeDays: 0 }, '2026-10-11')).toBe('2026-10-11');
    expect(defaultExpiry({ shelfLifeDays: null }, '2026-10-11')).toBeNull();
  });

  it('quyền huỷ phiếu pha: quản lý mọi phiếu; nhân viên phiếu của mình trong 60 phút', () => {
    const batch = { status: 'Completed' as const, createdById: 'lan', createdAt: '2026-10-11T08:00:00Z' };
    const at = (minutes: number) => new Date(Date.parse('2026-10-11T08:00:00Z') + minutes * 60_000);

    expect(canCancelBatch(batch, 'lan', false, at(60))).toBe(true);
    expect(canCancelBatch(batch, 'lan', false, at(61))).toBe(false);
    expect(canCancelBatch(batch, 'minh', false, at(1))).toBe(false);
    expect(canCancelBatch(batch, 'minh', true, at(600))).toBe(true);
    expect(canCancelBatch({ ...batch, status: 'Cancelled' }, 'minh', true, at(1))).toBe(false);
  });
});
