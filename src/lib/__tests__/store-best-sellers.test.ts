import { describe, it, expect } from 'vitest';

import type { StorefrontProduct } from 'src/lib/tenant-branding';

import { pickHeroProducts, bestSellersFirst } from '../store-best-sellers';

const item = (id: string, imageUrl: string | null = null): StorefrontProduct => ({
  id,
  code: id,
  name: id,
  price: 10_000,
  imageUrl,
  unit: null,
  categoryName: null,
  inStock: true,
});

describe('pickHeroProducts', () => {
  it('keeps best-seller rank but puts items with a system image first', () => {
    const best = [
      item('b1'),
      item('b2', '/img/b2.jpg'),
      item('b3'),
      item('b4'),
      item('b5', '/img/b5.jpg'),
    ];

    expect(pickHeroProducts(best, [item('x', '/img/x.jpg')]).map((p) => p.id)).toEqual([
      'b2',
      'b5',
      'b1',
      'b3',
    ]);
  });

  it('fills the hero with image-less best sellers instead of the plain list (placeholders, never other photos)', () => {
    const best = [item('b1'), item('b2')];

    expect(pickHeroProducts(best, [item('x', '/img/x.jpg')]).map((p) => p.id)).toEqual([
      'b1',
      'b2',
    ]);
  });

  it('falls back to the plain list when best sellers are unavailable', () => {
    const list = [item('a'), item('b', '/img/b.jpg')];

    expect(pickHeroProducts(null, list).map((p) => p.id)).toEqual(['b', 'a']);
    expect(pickHeroProducts([], list).map((p) => p.id)).toEqual(['b', 'a']);
  });
});

describe('bestSellersFirst', () => {
  it('puts best sellers first and drops duplicates from the list', () => {
    expect(
      bestSellersFirst([item('b'), item('a')], [item('a'), item('c')]).map((p) => p.id)
    ).toEqual(['b', 'a', 'c']);
    expect(bestSellersFirst(null, [item('a')]).map((p) => p.id)).toEqual(['a']);
  });
});
