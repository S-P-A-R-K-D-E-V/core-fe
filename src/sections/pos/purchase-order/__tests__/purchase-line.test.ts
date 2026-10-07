import { describe, expect, it } from 'vitest';

import { lineNetOf } from '../purchase-line';

describe('lineNetOf', () => {
  it('số lượng × đơn giá − chiết khấu (đồng hoặc %)', () => {
    expect(lineNetOf({ quantity: 5, unitPrice: 150000, discountType: 'amount', discountAmount: 0 })).toBe(750000);
    expect(lineNetOf({ quantity: 2, unitPrice: 50000, discountType: 'amount', discountAmount: 10000 })).toBe(90000);
    expect(lineNetOf({ quantity: 2, unitPrice: 50000, discountType: 'percent', discountAmount: 10 })).toBe(90000);
  });

  it('số lẻ', () => {
    expect(lineNetOf({ quantity: 0.5, unitPrice: 200000, discountAmount: 0 })).toBe(100000);
  });

  it('thành tiền nhập tay (hoá đơn chỉ ghi thành tiền) thắng đơn giá', () => {
    expect(lineNetOf({ quantity: 3, unitPrice: 33333.33, discountAmount: 0, lineTotal: 100000 })).toBe(100000);
    expect(lineNetOf({ quantity: 3, unitPrice: 1, lineTotal: null })).toBe(3);
  });
});
