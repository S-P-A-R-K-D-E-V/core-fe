import { describe, expect, it, beforeEach } from 'vitest';

import type { IStorefrontShippingQuote } from 'src/types/online-shop';

import {
  orderHref,
  orderItems,
  addressReady,
  rememberOrder,
  normalizeVnPhone,
  readRecentOrders,
  pickShippingOption,
  isShippingFeeChanged,
} from '../online-checkout-utils';

// ----------------------------------------------------------------------
// Trang đặt hàng online: giỏ → dòng đơn, số điện thoại (giống máy chủ), địa chỉ đủ để báo giá, giữ hãng khách chọn khi
// báo giá đổi, nhận ra lỗi "phí ship vừa đổi", nhớ đơn gần đây.
// ----------------------------------------------------------------------

const quote = (selection: 'cheapest' | 'choose'): IStorefrontShippingQuote => ({
  subtotal: 240_000,
  weightGrams: 500,
  carrierSelection: selection,
  options: [
    { connectionId: 'ghtk', carrier: 'ghtk', carrierLabel: 'GHTK', service: 'road', fee: 22_000, freeShipping: false },
    { connectionId: 'ghn', carrier: 'ghn', carrierLabel: 'GHN', service: '2', fee: 31_500, freeShipping: false },
  ],
  selected: { connectionId: 'ghtk', carrier: 'ghtk', carrierLabel: 'GHTK', service: 'road', fee: 22_000, freeShipping: false },
});

describe('online checkout utils', () => {
  beforeEach(() => window.localStorage.clear());

  it('giỏ → dòng đơn chỉ gồm sản phẩm có số lượng', () => {
    expect(
      orderItems([
        { id: 'p1', quantity: 2 } as any,
        { id: 'p2', quantity: 0 } as any,
      ])
    ).toEqual([{ productId: 'p1', quantity: 2 }]);
  });

  it.each([
    ['0912345678', '0912345678'],
    ['+84 912 345 678', '0912345678'],
    ['84912345678', '0912345678'],
    ['0912.345.678', '0912345678'],
    ['12345', null],
    ['', null],
  ])('số điện thoại %s → %s', (raw, expected) => {
    expect(normalizeVnPhone(raw)).toBe(expected);
  });

  it('địa chỉ cần tỉnh, phường và số nhà', () => {
    expect(addressReady({ provinceCode: '01', wardCode: '00004', street: '12 Phố' })).toBe(true);
    expect(addressReady({ provinceCode: '01', wardCode: '', street: '12 Phố' })).toBe(false);
    expect(addressReady({ provinceCode: '01', wardCode: '00004', street: ' a ' })).toBe(false);
  });

  it('chế độ cho khách chọn hãng giữ lựa chọn còn trong báo giá, không thì hãng máy chủ chọn', () => {
    expect(pickShippingOption(quote('choose'), { connectionId: 'ghn', service: '2' })?.fee).toBe(31_500);
    expect(pickShippingOption(quote('choose'), { connectionId: 'khac' })?.connectionId).toBe('ghtk');
    expect(pickShippingOption(quote('cheapest'), { connectionId: 'ghn', service: '2' })?.connectionId).toBe('ghtk');
    expect(pickShippingOption(null, null)).toBeNull();
  });

  it('nhận ra lỗi phí ship vừa đổi', () => {
    expect(isShippingFeeChanged({ errorCodes: ['OnlineOrder.ShippingFeeChanged'] })).toBe(true);
    expect(isShippingFeeChanged({ title: 'Phí giao hàng vừa cập nhật thành 25.000 ₫.' })).toBe(true);
    expect(isShippingFeeChanged({ title: 'Giỏ hàng trống.' })).toBe(false);
  });

  it('nhớ tối đa 5 đơn gần đây, đơn mới lên đầu, không trùng', () => {
    for (let i = 1; i <= 6; i += 1) rememberOrder(`W${i}`, `t${i}`);
    rememberOrder('W3', 't3');
    const recent = readRecentOrders();
    expect(recent.map((o) => o.code)).toEqual(['W3', 'W6', 'W5', 'W4', 'W2']);
    expect(orderHref('W3', 'a b')).toBe('/order/W3/?t=a%20b');
  });
});
