import type { IFnbMenuDish, IKitchenTicket } from 'src/types/fnb';

import { describe, expect, it } from 'vitest';

import { kitchenTicketHtml } from '../lib/print';
import { comboOptionLabel, dishNeedsOptions } from '../lib/menu';
import { addDraft, itemDraft, draftTotal, toLineInput, comboComponents } from '../lib/draft';

// ----------------------------------------------------------------------

const option = (productId: string, name: string, over: object = {}) => ({
  productId,
  dishId: `dish-${productId}`,
  name,
  variantName: null as string | null,
  quantity: 1,
  price: 30_000,
  surcharge: 0,
  isSoldOut: false,
  sortOrder: 1,
  ...over,
});

// Combo sáng 45 000: đồ uống (Bạc xỉu mặc định, hoặc Cà phê sữa L +5 000) + Bánh flan cố định.
const combo: IFnbMenuDish = {
  id: 'combo',
  categoryId: null,
  code: 'CB',
  name: 'Combo sáng',
  imageUrl: null,
  sortOrder: 1,
  isSoldOut: false,
  priceFrom: 45_000,
  variants: [{ productId: 'combo', name: null, price: 45_000, isSoldOut: false, sortOrder: 1 }],
  toppingIds: ['tp'],
  combo: {
    groups: [
      {
        id: 'drinks',
        name: 'Đồ uống',
        sortOrder: 1,
        options: [
          option('bx', 'Bạc xỉu'),
          option('cfl', 'Cà phê sữa', { variantName: 'L', price: 35_000, surcharge: 5_000, sortOrder: 2 }),
        ],
      },
      { id: 'cakes', name: 'Bánh', sortOrder: 2, options: [option('flan', 'Bánh flan', { price: 25_000 })] },
    ],
  },
};
const variant = combo.variants[0];

const plain: IFnbMenuDish = { ...combo, id: 'bx', name: 'Bạc xỉu', toppingIds: [], combo: null };

describe('lựa chọn của combo', () => {
  it('nhóm chưa chọn lấy lựa chọn đầu; chọn rồi thì theo lựa chọn', () => {
    expect(comboComponents(combo).map((c) => c.productId)).toEqual(['bx', 'flan']);
    expect(comboComponents(combo, { drinks: 'cfl' }).map((c) => [c.productId, c.variantName, c.surcharge])).toEqual([
      ['cfl', 'L', 5_000],
      ['flan', null, 0],
    ]);
    expect(comboComponents(plain)).toEqual([]);
  });

  it('lựa chọn mặc định đã hết thì lấy lựa chọn còn bán kế tiếp', () => {
    const soldOut: IFnbMenuDish = {
      ...combo,
      combo: {
        groups: [
          { ...combo.combo!.groups[0], options: [option('bx', 'Bạc xỉu', { isSoldOut: true }), combo.combo!.groups[0].options[1]] },
          combo.combo!.groups[1],
        ],
      },
    };
    expect(comboComponents(soldOut)[0].productId).toBe('cfl');
  });

  it('nhãn lựa chọn có size, phụ thu và trạng thái hết', () => {
    expect(comboOptionLabel(combo.combo!.groups[0].options[1])).toBe('Cà phê sữa (L) · +5.000 đ');
    expect(comboOptionLabel(option('x', 'Bánh', { quantity: 2, isSoldOut: true }))).toBe('Bánh x2 · hết');
  });

  it('combo có nhóm nhiều lựa chọn mới cần mở hộp thoại', () => {
    expect(dishNeedsOptions(null, combo)).toBe(true);
    expect(dishNeedsOptions(null, { ...combo, combo: { groups: [combo.combo!.groups[1]] } })).toBe(false);
  });
});

describe('dòng combo đang chọn', () => {
  it('giá = giá combo + phụ thu, không nhận món thêm', () => {
    const base = itemDraft(combo, variant, { toppings: [{ productId: 'tp', name: 'Trân châu', quantity: 1, unitPrice: 5_000 }] });
    expect([base.unitPrice, base.toppings.length, base.components.length]).toEqual([45_000, 0, 2]);

    const upsized = itemDraft(combo, variant, { quantity: 2, components: comboComponents(combo, { drinks: 'cfl' }) });
    expect(upsized.unitPrice).toBe(50_000);
    expect(draftTotal([base, upsized])).toBe(145_000);
  });

  it('cùng lựa chọn thì cộng số lượng, khác lựa chọn thì thành dòng riêng', () => {
    let drafts = addDraft([], itemDraft(combo, variant));
    drafts = addDraft(drafts, itemDraft(combo, variant));
    drafts = addDraft(drafts, itemDraft(combo, variant, { components: comboComponents(combo, { drinks: 'cfl' }) }));
    expect(drafts.map((d) => d.quantity)).toEqual([2, 1]);
  });

  it('gửi lựa chọn của từng nhóm; món thường không gửi components', () => {
    const input = toLineInput(itemDraft(combo, variant, { components: comboComponents(combo, { drinks: 'cfl' }) }));
    expect(input).toMatchObject({
      productId: 'combo',
      toppings: [],
      components: [
        { groupId: 'drinks', productId: 'cfl' },
        { groupId: 'cakes', productId: 'flan' },
      ],
    });
    expect('components' in toLineInput(itemDraft(plain, plain.variants[0]))).toBe(false);
  });
});

describe('phiếu bar', () => {
  it('in từng món thành phần với tổng số lượng phải làm', () => {
    const ticket = {
      id: 't1',
      kind: 'Order',
      roundNo: 1,
      displayNo: '7',
      tableName: 'Bàn 5',
      areaName: null,
      createdAt: '2026-10-12T03:00:00Z',
      createdByName: 'Lan',
      voidReason: null,
      lines: [
        {
          lineId: 'l1',
          name: 'Combo sáng',
          variantName: null,
          quantity: 2,
          toppings: [],
          quickNotes: ['Ít đá'],
          note: null,
          components: [
            { name: 'Cà phê sữa', variantName: 'L', quantity: 1 },
            { name: 'Bánh flan', variantName: null, quantity: 2 },
          ],
        },
      ],
    } as unknown as IKitchenTicket;

    const html = kitchenTicketHtml(ticket);
    expect(html).toContain('<b>- Cà phê sữa (L)</b><b>2</b>');
    expect(html).toContain('<b>- Bánh flan</b><b>4</b>');
    expect(html).toContain('* Ít đá');
  });
});
