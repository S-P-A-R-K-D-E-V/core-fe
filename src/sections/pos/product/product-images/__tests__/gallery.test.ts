import { describe, expect, it } from 'vitest';

import { move, append, remove, sameOrder, makePrimary, MAX_PRODUCT_IMAGES } from '../gallery';

describe('bộ ảnh sản phẩm', () => {
  const urls = ['a', 'b', 'c'];

  it('đặt ảnh chính = đưa lên đầu', () => {
    expect(makePrimary(urls, 'c')).toEqual(['c', 'a', 'b']);
    expect(makePrimary(urls, 'x')).toBe(urls);
  });

  it('đổi chỗ với ảnh bên cạnh, không ra ngoài mép', () => {
    expect(move(urls, 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(move(urls, 'b', 1)).toEqual(['a', 'c', 'b']);
    expect(move(urls, 'a', -1)).toBe(urls);
    expect(move(urls, 'c', 1)).toBe(urls);
  });

  it('xoá và thêm (bỏ trùng, tối đa 12 ảnh)', () => {
    expect(remove(urls, 'b')).toEqual(['a', 'c']);
    expect(append(urls, ['c', 'd'])).toEqual({ urls: ['a', 'b', 'c', 'd'], dropped: 0 });
    const full = Array.from({ length: MAX_PRODUCT_IMAGES }, (_, i) => `u${i}`);
    expect(append(full, ['x', 'y'])).toEqual({ urls: full, dropped: 2 });
  });

  it('so thứ tự', () => {
    expect(sameOrder(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameOrder(['a', 'b'], ['b', 'a'])).toBe(false);
  });
});
