import { describe, expect, it } from 'vitest';

import type { IProductListItem } from 'src/types/corecms-api';

import {
  clampOrderDiscount,
  findScannedProduct,
  isDefinitiveRejection,
  parseQuantityInput,
  percentDiscount,
  quickCashAmounts,
  saleFingerprint,
  saleRequestFor,
  settlePayments,
} from 'src/sections/pos/sale/pos-sale-utils';

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

describe('settlePayments', () => {
  it('khách đưa dư tiền mặt → khoản thu = số phải trả, phần dư là tiền thối', () => {
    expect(settlePayments(320000, [{ method: 'Cash', amount: 500000 }])).toEqual({
      payments: [{ method: 'Cash', amount: 320000, transactionRef: undefined }],
      cashTendered: 500000,
      change: 180000,
      paid: 320000,
    });
  });

  it('trả đúng → không gửi tiền khách đưa', () => {
    const r = settlePayments(52000, [{ method: 'Cash', amount: 52000 }]);
    expect(r.cashTendered).toBeUndefined();
    expect(r.change).toBe(0);
    expect(r.payments).toEqual([{ method: 'Cash', amount: 52000, transactionRef: undefined }]);
  });

  it('chuyển khoản giữ nguyên, tiền mặt chỉ bù phần còn lại', () => {
    const r = settlePayments(300000, [
      { method: 'BankTransfer', amount: 200000, transactionRef: 'FT1' },
      { method: 'Cash', amount: 200000 },
    ]);
    expect(r.payments).toEqual([
      { method: 'BankTransfer', amount: 200000, transactionRef: 'FT1' },
      { method: 'Cash', amount: 100000, transactionRef: undefined },
    ]);
    expect(r.cashTendered).toBe(200000);
    expect(r.change).toBe(100000);
  });

  it('thiếu tiền → gửi đúng số đã thu, không tự bù', () => {
    const r = settlePayments(100000, [{ method: 'Cash', amount: 80000 }]);
    expect(r.paid).toBe(80000);
    expect(r.cashTendered).toBeUndefined();
  });

  it('bỏ dòng 0 đồng', () => {
    expect(settlePayments(0, [{ method: 'Cash', amount: 0 }]).payments).toEqual([]);
  });
});

describe('mã chống trùng', () => {
  const base = {
    customerId: 'c1',
    warehouseId: 'w1',
    discount: 0,
    items: [{ productId: 'p1', quantity: 1, price: 52000, discount: 0 }],
  };

  it('giỏ không đổi → dùng lại mã cũ; giỏ đổi → mã mới', () => {
    const fp = saleFingerprint(base);
    const first = saleRequestFor(undefined, fp, () => 'id-1');
    expect(first).toEqual({ id: 'id-1', fingerprint: fp });
    expect(saleRequestFor(first, saleFingerprint({ ...base }), () => 'id-2').id).toBe('id-1');
    const changed = saleFingerprint({ ...base, items: [{ ...base.items[0], quantity: 2 }] });
    expect(saleRequestFor(first, changed, () => 'id-2').id).toBe('id-2');
  });

  it('chỉ lỗi 4xx của máy chủ mới chắc chắn chưa tạo hoá đơn', () => {
    expect(isDefinitiveRejection({ status: 400, title: 'x' })).toBe(true);
    expect(isDefinitiveRejection({ status: 409 })).toBe(true);
    expect(isDefinitiveRejection({ status: 500 })).toBe(false);
    expect(isDefinitiveRejection('Something went wrong')).toBe(false);
    expect(isDefinitiveRejection('<html>502</html>')).toBe(false);
    expect(isDefinitiveRejection(undefined)).toBe(false);
  });
});

describe('giảm giá hoá đơn', () => {
  it('theo tiền: 0 … tổng tiền hàng', () => {
    expect(clampOrderDiscount(5000, 20000)).toBe(5000);
    expect(clampOrderDiscount(30000, 20000)).toBe(20000);
    expect(clampOrderDiscount(-1, 20000)).toBe(0);
    expect(clampOrderDiscount(Number.NaN, 20000)).toBe(0);
  });

  it('theo %: kẹp 0 … 100, làm tròn tới đồng', () => {
    expect(percentDiscount(10, 52000)).toEqual({ percent: 10, amount: 5200 });
    expect(percentDiscount(150, 52000)).toEqual({ percent: 100, amount: 52000 });
    expect(percentDiscount(3, 33333)).toEqual({ percent: 3, amount: 1000 });
  });
});

describe('quickCashAmounts', () => {
  it('đúng tiền + làm tròn lên mệnh giá hay gặp, không trùng', () => {
    expect(quickCashAmounts(32000)).toEqual([32000, 40000, 50000, 100000, 200000]);
    expect(quickCashAmounts(50000)).toEqual([50000, 100000, 200000, 500000]);
    expect(quickCashAmounts(0)).toEqual([]);
  });
});
