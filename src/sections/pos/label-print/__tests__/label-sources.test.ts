import { describe, expect, it } from 'vitest';

import type { IProduct, IProductChild, IProductListItem } from 'src/types/corecms-api';

import { labelSourceFromProduct, labelSourcesFromProducts } from '../label-sources';

// ----------------------------------------------------------------------
// Sản phẩm của API → dòng in tem: mỗi mã hàng một dòng, hàng con (biến thể / đơn vị quy đổi) tách riêng.
// ----------------------------------------------------------------------

const listItem = (overrides: Partial<IProductListItem>): IProductListItem => ({
  id: 'p1',
  code: 'SP000123',
  name: 'Áo thun cổ tròn',
  categoryName: 'Áo',
  hasVariants: false,
  basePrice: 185000,
  productType: 2,
  isActive: true,
  minQuantity: 0,
  maxQuantity: 0,
  createdDate: '2026-10-01T00:00:00Z',
  ...overrides,
});

const child = (overrides: Partial<IProductChild>): IProductChild => ({
  id: 'c1',
  code: 'SP000123-1',
  name: 'Áo thun cổ tròn',
  fullName: 'Áo thun cổ tròn - Trắng - L',
  basePrice: 195000,
  isActive: true,
  ...overrides,
});

describe('labelSourceFromProduct', () => {
  it('một mã hàng: tên đầy đủ, mã, mã vạch, giá bán, mặc định 1 tem', () => {
    const product = listItem({ fullName: 'Áo thun cổ tròn - Trắng - M', barCode: '8934567890120' });

    expect(labelSourceFromProduct(product)).toEqual({
      key: 'p1',
      name: 'Áo thun cổ tròn - Trắng - M',
      code: 'SP000123',
      barcode: '8934567890120',
      price: 185000,
      unit: null,
      quantity: 1,
    });
  });

  it('đơn vị tính: lấy từ chi tiết sản phẩm (unit / unitOfMeasureName); dòng danh sách không có thì null', () => {
    const detail = { ...listItem({}), categoryId: 'cat', allowsSale: true, unit: 'cái' } as IProduct;
    const newSchema = { ...listItem({}), categoryId: 'cat', allowsSale: true, unitOfMeasureName: 'hộp' } as IProduct;

    expect(labelSourceFromProduct(detail).unit).toBe('cái');
    expect(labelSourceFromProduct(newSchema).unit).toBe('hộp');
    expect(labelSourceFromProduct(listItem({})).unit).toBeNull();
    expect(labelSourceFromProduct(child({})).unit).toBeNull();
  });

  it('không có mã vạch → null (hộp thoại sẽ dùng mã hàng); nhận cả trường `barcode` của schema mới', () => {
    expect(labelSourceFromProduct(listItem({})).barcode).toBeNull();
    expect(labelSourceFromProduct(listItem({ barcode: '2000000000015' })).barcode).toBe('2000000000015');
    expect(labelSourceFromProduct(listItem({}), 5).quantity).toBe(5);
  });

  it('chi tiết sản phẩm (IProduct) có hàng con: vẫn chỉ là MỘT dòng của chính mã đó', () => {
    const detail = {
      ...listItem({ barCode: '8934567890120' }),
      categoryId: 'cat',
      allowsSale: true,
      childProducts: [child({})],
    } as IProduct;

    expect(labelSourceFromProduct(detail)).toMatchObject({ key: 'p1', code: 'SP000123' });
  });
});

describe('labelSourcesFromProducts', () => {
  it('hàng thường → một dòng mỗi sản phẩm, giữ thứ tự chọn', () => {
    const sources = labelSourcesFromProducts([
      listItem({ id: 'a', code: 'A1' }),
      listItem({ id: 'b', code: 'B1', barCode: '12345678' }),
    ]);

    expect(sources.map((source) => [source.key, source.code, source.barcode, source.quantity])).toEqual([
      ['a', 'A1', null, 1],
      ['b', 'B1', '12345678', 1],
    ]);
  });

  it('hàng có biến thể: hàng cha rồi từng hàng con, mỗi dòng có mã / mã vạch / giá riêng', () => {
    const product = listItem({
      fullName: 'Áo thun cổ tròn - Trắng - M',
      barCode: '8934567890120',
      hasVariants: true,
      childProducts: [
        child({ id: 'c1', code: 'SP000123-1', barCode: '8934567890137', basePrice: 195000 }),
        child({ id: 'c2', code: 'SP000123-2', fullName: 'Áo thun cổ tròn - Đen - M', basePrice: 185000 }),
        child({ id: 'c3', code: 'SP000123-T', fullName: 'Áo thun cổ tròn (Thùng 10)', conversionValue: 10, basePrice: 1700000 }),
      ],
    });

    expect(labelSourcesFromProducts([product])).toEqual([
      { key: 'p1', name: 'Áo thun cổ tròn - Trắng - M', code: 'SP000123', barcode: '8934567890120', price: 185000, unit: null, quantity: 1 },
      { key: 'c1', name: 'Áo thun cổ tròn - Trắng - L', code: 'SP000123-1', barcode: '8934567890137', price: 195000, unit: null, quantity: 1 },
      { key: 'c2', name: 'Áo thun cổ tròn - Đen - M', code: 'SP000123-2', barcode: null, price: 185000, unit: null, quantity: 1 },
      { key: 'c3', name: 'Áo thun cổ tròn (Thùng 10)', code: 'SP000123-T', barcode: null, price: 1700000, unit: null, quantity: 1 },
    ]);
  });

  it('hàng con không có mã lẫn mã vạch thì bỏ qua', () => {
    const product = listItem({ childProducts: [child({ id: 'c9', code: '', barCode: undefined })] });

    expect(labelSourcesFromProducts([product]).map((source) => source.key)).toEqual(['p1']);
  });

  it('API trả thẳng `variants` (không có childProducts): mỗi biến thể có mã là một dòng, giá lấy của biến thể hoặc hàng cha', () => {
    const product = listItem({
      hasVariants: true,
      variants: [
        { id: 'v1', name: 'Áo - Trắng', sku: 'AO-TR', barcode: '8934567890120', sellingPrice: 190000 },
        { id: 'v2', name: 'Áo - Đen', sku: 'AO-DE' },
        { id: 'v3', name: 'Áo - chưa có mã', sku: '' },
      ],
    });

    expect(labelSourcesFromProducts([product])).toEqual([
      { key: 'p1', name: 'Áo thun cổ tròn', code: 'SP000123', barcode: null, price: 185000, unit: null, quantity: 1 },
      { key: 'v1', name: 'Áo - Trắng', code: 'AO-TR', barcode: '8934567890120', price: 190000, unit: null, quantity: 1 },
      { key: 'v2', name: 'Áo - Đen', code: 'AO-DE', barcode: null, price: 185000, unit: null, quantity: 1 },
    ]);
  });

  it('chọn trùng (hàng con cũng được chọn riêng) → mỗi mã chỉ một dòng', () => {
    const parent = listItem({ childProducts: [child({ id: 'c1' })] });
    const sameChild = listItem({ id: 'c1', code: 'SP000123-1' });

    expect(labelSourcesFromProducts([parent, sameChild]).map((source) => source.key)).toEqual(['p1', 'c1']);
  });
});
