import { describe, expect, it } from 'vitest';

import {
  move,
  append,
  remove,
  sameOrder,
  makePrimary,
  nextVariant,
  MAX_PRODUCT_IMAGES,
} from '../gallery';

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

describe('nextVariant (Lưu & sang mẫu tiếp)', () => {
  const v = (id: string, coverUrl: string | null = null) => ({ id, coverUrl });

  it('nhảy tới mẫu chưa có ảnh đứng sau, vòng lại từ đầu', () => {
    const list = [v('18k'), v('25k', 'a.jpg'), v('50k'), v('70k', 'b.jpg')];
    expect(nextVariant(list, '25k')?.id).toBe('50k');
    expect(nextVariant(list, '50k')?.id).toBe('18k');
  });

  it('mọi mẫu đã có ảnh thì sang mẫu ngay sau; một mẫu thì không có', () => {
    expect(nextVariant([v('a', 'x'), v('b', 'y')], 'a')?.id).toBe('b');
    expect(nextVariant([v('a')], 'a')).toBeNull();
  });
});
