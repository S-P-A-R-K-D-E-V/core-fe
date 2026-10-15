import { describe, expect, it } from 'vitest';

import type { IProductListItem } from 'src/types/corecms-api';

import { findScannedProduct, parseQuantityInput } from 'src/sections/pos/sale/pos-sale-utils';

const product = (over: Partial<IProductListItem>): IProductListItem =>
  ({
    id: 'p',
    code: 'SP1',
    name: 'Sản phẩm',
    categoryName: '',
    hasVariants: false,
    basePrice: 1000,
    productType: 2,
    isActive: true,
    minQuantity: 0,
    maxQuantity: 0,
    createdDate: '2026-10-01T00:00:00Z',
    ...over,
  }) as IProductListItem;

const kep = product({ id: 'kep', code: 'SP000123', barCode: '8930001', sku: 'SP000123' });
const kepXanh = product({ id: 'kep-xanh', code: 'SP0001234', barCode: '8930002' });
const vi = product({
  id: 'vi',
  code: 'SP015256',
  childProducts: [
    {
      id: 'c-85',
      code: 'SP015259',
      barCode: '8935259',
      name: 'Ví',
      fullName: 'Ví - 85',
      basePrice: 85000,
      isActive: true,
    },
  ],
});

describe('findScannedProduct', () => {
  it('khớp đúng mã / mã vạch (không phân biệt hoa thường, bỏ khoảng trắng)', () => {
    expect(findScannedProduct([kep, kepXanh], ' sp000123 ')?.product.id).toBe('kep');
    expect(findScannedProduct([kep, kepXanh], '8930002')?.product.id).toBe('kep-xanh');
  });

  it('mã của phiên bản con → thêm thẳng phiên bản đó', () => {
    const hit = findScannedProduct([vi, kep], '8935259');
    expect(hit?.product.id).toBe('vi');
    expect(hit?.child?.id).toBe('c-85');
  });

  it('không khớp đúng mà chỉ một kết quả → lấy kết quả đó; nhiều kết quả → để thu ngân chọn', () => {
    expect(findScannedProduct([kep], 'nơ đỏ')?.product.id).toBe('kep');
    expect(findScannedProduct([kep, kepXanh], 'kẹp')).toBeNull();
    expect(findScannedProduct([], 'x')).toBeNull();
    expect(findScannedProduct([kep], '   ')).toBeNull();
  });
});

describe('parseQuantityInput', () => {
  it('chỉ nhận số nguyên ≥ 1', () => {
    expect(parseQuantityInput('3')).toBe(3);
    expect(parseQuantityInput('12a')).toBe(12);
    expect(parseQuantityInput('')).toBeNull();
    expect(parseQuantityInput('0')).toBeNull();
    expect(parseQuantityInput('-')).toBeNull();
  });
});
