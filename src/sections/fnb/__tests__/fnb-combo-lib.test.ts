import type { IFnbComboItem } from 'src/types/fnb';

import { describe, expect, it } from 'vitest';

import {
  comboSaving,
  groupDrafts,
  toGroupInputs,
  comboGroupsError,
  draftComponentsPrice,
  type ComboGroupDraft,
} from '../lib/combo';

// ----------------------------------------------------------------------

const choices = [
  { productId: 'bx', dishId: 'bx', name: 'Bạc xỉu', variantName: null, price: 30_000 },
  { productId: 'cfl', dishId: 'cf', name: 'Cà phê sữa', variantName: 'L', price: 35_000 },
  { productId: 'flan', dishId: 'flan', name: 'Bánh flan', variantName: null, price: 25_000 },
];

const combo: IFnbComboItem = {
  productId: 'combo',
  code: 'CB',
  name: 'Combo sáng',
  price: 45_000,
  isOnMenu: true,
  componentsPrice: 55_000,
  groups: [
    {
      id: 'g1',
      name: 'Đồ uống',
      options: [
        { productId: 'bx', name: 'Bạc xỉu', variantName: null, quantity: 1, surcharge: 0, price: 30_000, isAvailable: true },
        { productId: 'cfl', name: 'Cà phê sữa', variantName: 'L', quantity: 1, surcharge: 5_000, price: 35_000, isAvailable: true },
      ],
    },
    {
      id: 'g2',
      name: 'Bánh',
      options: [{ productId: 'flan', name: 'Bánh flan', variantName: null, quantity: 1, surcharge: 0, price: 25_000, isAvailable: true }],
    },
  ],
};

const drafts = (): ComboGroupDraft[] => groupDrafts(combo);

describe('soạn combo', () => {
  it('combo mới bắt đầu với một nhóm trống; combo đã lưu nạp đủ nhóm và lựa chọn', () => {
    expect(groupDrafts(null)).toEqual([{ name: '', options: [{ productId: '', quantity: '1', surcharge: '0' }] }]);
    expect(drafts().map((g) => [g.name, g.options.length])).toEqual([
      ['Đồ uống', 2],
      ['Bánh', 1],
    ]);
  });

  it('dữ liệu gửi đi là số, tên nhóm bỏ khoảng trắng thừa', () => {
    const groups = drafts();
    groups[0].name = '  Đồ uống ';
    expect(toGroupInputs(groups)[0]).toEqual({
      name: 'Đồ uống',
      options: [
        { productId: 'bx', quantity: 1, surcharge: 0 },
        { productId: 'cfl', quantity: 1, surcharge: 5_000 },
      ],
    });
  });

  it('so giá combo với mua lẻ lựa chọn mặc định', () => {
    expect(draftComponentsPrice(drafts(), choices)).toBe(55_000);
    expect(comboSaving(combo)).toBe(10_000);

    const doubled = drafts();
    doubled[1].options[0].quantity = '2';
    expect(draftComponentsPrice(doubled, choices)).toBe(80_000);
  });
});

describe('kiểm tra trước khi lưu', () => {
  const broken = (change: (groups: ComboGroupDraft[]) => void) => {
    const groups = drafts();
    change(groups);
    return comboGroupsError(groups);
  };

  it('combo hợp lệ thì không có lỗi', () => {
    expect(comboGroupsError(drafts())).toBeNull();
  });

  it('thiếu nhóm, thiếu tên, thiếu món, món trùng', () => {
    expect(comboGroupsError([])).toBe('Combo cần ít nhất một nhóm.');
    expect(broken((g) => { g[1].name = ' '; })).toBe('Nhóm 2 chưa có tên.');
    expect(broken((g) => { g[0].options[1].productId = ''; })).toBe('Nhóm "Đồ uống" có lựa chọn chưa chọn món.');
    expect(broken((g) => { g[0].options[1].productId = 'bx'; })).toBe('Nhóm "Đồ uống" có món bị chọn hai lần.');
    expect(broken((g) => { g[1].options = []; })).toBe('Nhóm "Bánh" chưa có lựa chọn.');
  });

  it('số lượng 1–20 nguyên, phụ thu không âm', () => {
    expect(broken((g) => { g[0].options[0].quantity = '0'; })).toBe('Nhóm "Đồ uống": số lượng phải từ 1 đến 20.');
    expect(broken((g) => { g[0].options[0].quantity = '1.5'; })).toBe('Nhóm "Đồ uống": số lượng phải từ 1 đến 20.');
    expect(broken((g) => { g[0].options[1].surcharge = '-1000'; })).toBe('Nhóm "Đồ uống": phụ thu phải là số tiền không âm.');
    expect(broken((g) => { g[0].options[1].surcharge = ''; })).toBe('Nhóm "Đồ uống": phụ thu phải là số tiền không âm.');
  });
});
