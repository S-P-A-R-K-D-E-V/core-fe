import { describe, it, expect } from 'vitest';

import { isShopRef, normalizeVnPhone } from '../settings/shipping-connect-utils';

describe('normalizeVnPhone', () => {
  it('chuẩn hoá SĐT di động về dạng 0xxxxxxxxx', () => {
    expect(normalizeVnPhone('0912 345 678')).toBe('0912345678');
    expect(normalizeVnPhone('+84 912.345.678')).toBe('0912345678');
    expect(normalizeVnPhone('84912345678')).toBe('0912345678');
  });

  it('từ chối số không đủ 10 chữ số hoặc không bắt đầu bằng 0', () => {
    expect(normalizeVnPhone('091234567')).toBeNull();
    expect(normalizeVnPhone('1912345678')).toBeNull();
    expect(normalizeVnPhone('')).toBeNull();
  });
});

describe('isShopRef', () => {
  it('chỉ nhận mã shop là số dương', () => {
    expect(isShopRef('885')).toBe(true);
    expect(isShopRef(' 4567890 ')).toBe(true);
    expect(isShopRef('0')).toBe(false);
    expect(isShopRef('abc')).toBe(false);
    expect(isShopRef('')).toBe(false);
  });
});
