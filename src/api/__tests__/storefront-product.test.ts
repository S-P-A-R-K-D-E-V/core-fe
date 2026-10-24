import { describe, expect, it, vi } from 'vitest';

// ----------------------------------------------------------------------
// Trang /product của cửa hàng online chỉ đọc /public/storefront/products (giá bán, ảnh, còn/hết hàng) — không gọi
// /products của dashboard (tồn từng chi nhánh, mã KiotViet… chỉ dành cho nhân viên đăng nhập).
// ----------------------------------------------------------------------

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'x' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

// eslint-disable-next-line import/first
import { productListKey, storefrontProductListKey } from '../product-keys';
// eslint-disable-next-line import/first
import { STOREFRONT_MAX_QUANTITY, mapStorefrontProduct } from '../product';

describe('storefrontProductListKey', () => {
  it('reads the public list, newest first', () => {
    expect(storefrontProductListKey()).toBe('/public/storefront/products?page=1&pageSize=24&sort=newest');
    expect(storefrontProductListKey({ keyword: 'ghim tăm', page: 2 })).toBe(
      '/public/storefront/products?page=2&pageSize=24&sort=newest&q=ghim+t%C4%83m'
    );
  });

  it('leaves the dashboard key on /products', () => {
    expect(productListKey()).toMatch(/^\/products\?/);
  });
});

describe('mapStorefrontProduct', () => {
  it('maps a list item (one image, in stock) without a stock count', () => {
    const p = mapStorefrontProduct({
      id: 'a57b8e74-3123-47ca-878f-9fdc81f87df3',
      code: 'CC003065',
      name: 'Ghim tăm - GT15',
      price: 15000,
      imageUrl: 'https://cdn2-retail-images.kiotviet.vn/cici68/gt15.jpeg',
      unit: null,
      categoryName: 'PHỤ KIỆN TÓC',
      inStock: true,
    });

    expect(p).toMatchObject({
      id: 'a57b8e74-3123-47ca-878f-9fdc81f87df3',
      name: 'Ghim tăm - GT15',
      price: 15000,
      priceSale: 0,
      coverUrl: 'https://cdn2-retail-images.kiotviet.vn/cici68/gt15.jpeg',
      category: 'PHỤ KIỆN TÓC',
      inventoryType: 'in_stock',
      available: STOREFRONT_MAX_QUANTITY,
      colors: [],
      sizes: [],
      totalReviews: 0,
    });
  });

  it('maps a detail (image list, description, out of stock)', () => {
    const p = mapStorefrontProduct({
      id: '1617495c-9f70-496d-9a71-83cedd57a034',
      code: 'SP015692',
      name: 'Ghim tăm - GT25',
      price: 25000,
      imageUrls: ['products/gt25-1.jpg', 'https://cdn.example/gt25-2.jpg'],
      description: 'Ghim tăm kim loại',
      inStock: false,
    });

    expect(p.images).toEqual(['/media/products/gt25-1.jpg', 'https://cdn.example/gt25-2.jpg']);
    expect(p.coverUrl).toBe('/media/products/gt25-1.jpg');
    expect(p.description).toBe('Ghim tăm kim loại');
    expect(p.inventoryType).toBe('out_of_stock');
    expect(p.available).toBe(0);
  });

  it('falls back to the placeholder image', () => {
    expect(mapStorefrontProduct({ id: 'x', code: 'X', name: 'X', price: 1, inStock: true }).coverUrl).toBe(
      '/assets/placeholder.svg'
    );
  });
});
