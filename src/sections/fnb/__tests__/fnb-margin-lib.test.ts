import type { IFnbDishMarginRow } from 'src/types/fnb';

import { describe, expect, it } from 'vitest';

import { fPercent, marginTone, sortMarginRows, filterMarginRows } from '../lib/margin';

// ----------------------------------------------------------------------

const row = (over: Partial<IFnbDishMarginRow>): IFnbDishMarginRow => ({
  id: over.name ?? 'x',
  code: '',
  name: 'x',
  kind: 'dish',
  quantity: 1,
  revenue: 0,
  averagePrice: null,
  cost: 0,
  unitCost: null,
  profit: 0,
  marginRate: null,
  uncostedQuantity: 0,
  uncostedRevenue: 0,
  revenueShare: null,
  ...over,
});

const coffee = row({ name: 'Cà phê sữa - L', revenue: 70_000, cost: 19_800, profit: 50_200, marginRate: 0.7171, quantity: 2 });
const pearl = row({ name: 'Trân châu', kind: 'topping', revenue: 10_000, cost: 1_200, profit: 8_800, marginRate: 0.88, quantity: 2 });
const bacXiu = row({ name: 'Bạc xỉu', revenue: 30_000, uncostedQuantity: 1, uncostedRevenue: 30_000 });
const water = row({ name: 'Nước suối', kind: 'goods', revenue: 27_000, cost: 30_000, profit: -3_000, marginRate: -0.1111, quantity: 3 });
const rows = [coffee, pearl, bacXiu, water];

describe('lọc', () => {
  it('theo loại, và mặt hàng có dòng chưa có giá vốn', () => {
    expect(filterMarginRows(rows, 'all')).toHaveLength(4);
    expect(filterMarginRows(rows, 'dish')).toEqual([coffee, bacXiu]);
    expect(filterMarginRows(rows, 'topping')).toEqual([pearl]);
    expect(filterMarginRows(rows, 'goods')).toEqual([water]);
    expect(filterMarginRows(rows, 'uncosted')).toEqual([bacXiu]);
  });
});

describe('sắp xếp', () => {
  it('lãi gộp giảm dần; bằng nhau thì theo tên', () => {
    expect(sortMarginRows(rows, 'profit', 'desc').map((r) => r.name)).toEqual([
      'Cà phê sữa - L',
      'Trân châu',
      'Bạc xỉu',
      'Nước suối',
    ]);
  });

  it('tỷ lệ: dòng chưa có tỷ lệ luôn nằm cuối, cả khi đảo chiều', () => {
    expect(sortMarginRows(rows, 'marginRate', 'desc').map((r) => r.name)).toEqual([
      'Trân châu',
      'Cà phê sữa - L',
      'Nước suối',
      'Bạc xỉu',
    ]);
    expect(sortMarginRows(rows, 'marginRate', 'asc').map((r) => r.name)).toEqual([
      'Nước suối',
      'Cà phê sữa - L',
      'Trân châu',
      'Bạc xỉu',
    ]);
  });

  it('theo tên tiếng Việt và không sửa mảng gốc', () => {
    expect(sortMarginRows(rows, 'name', 'asc').map((r) => r.name)).toEqual([
      'Bạc xỉu',
      'Cà phê sữa - L',
      'Nước suối',
      'Trân châu',
    ]);
    expect(rows[0]).toBe(coffee);
  });
});

describe('tỷ lệ lãi gộp', () => {
  it('lỗ = đỏ, dưới 50% = vàng, còn lại bình thường', () => {
    expect(marginTone(-0.1)).toBe('error');
    expect(marginTone(0.49)).toBe('warning');
    expect(marginTone(0.5)).toBe('default');
    expect(marginTone(null)).toBe('default');
  });

  it('hiển thị phần trăm một số lẻ', () => {
    expect(fPercent(0.7171)).toBe('71,7%');
    expect(fPercent(null)).toBe('—');
  });
});
