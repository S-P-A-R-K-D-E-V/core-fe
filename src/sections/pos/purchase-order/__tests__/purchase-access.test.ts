import { describe, expect, it } from 'vitest';

import { lockedByPaidBy, purchaseAccessFor } from '../purchase-access';

// ----------------------------------------------------------------------
// Nút ở mục Nhập hàng / Nhà cung cấp theo quyền purchase.* / supplier.* (Core-be). Đơn do cổ đông chi hộ: sửa / huỷ cần
// thêm purchase.paid-by.set (API trả 403 KiotVietPurchaseOrder.PaidByForbidden).
// ----------------------------------------------------------------------

const MANAGER_DEFAULTS = [
  'purchase.read',
  'purchase.create',
  'purchase.update',
  'purchase.confirm',
  'purchase.receive',
  'purchase.cancel',
  'purchase.paid-by.set',
  'purchase.payment.manage',
  'supplier.read',
  'supplier.manage',
  'products.cost.read',
  'products.create',
];

describe('purchaseAccessFor', () => {
  it('chủ cửa hàng và Manager (quyền mặc định) làm được mọi thao tác', () => {
    [purchaseAccessFor({ role: 'Admin' }), purchaseAccessFor({ role: 'Manager', permissions: MANAGER_DEFAULTS })].forEach(
      (access) => expect(Object.values(access).every(Boolean)).toBe(true)
    );
  });

  it('"Thủ kho" chỉ nhận hàng: không tạo / duyệt / huỷ, không thấy giá vốn', () => {
    const keeper = purchaseAccessFor({ role: 'Staff', permissions: ['purchase.read', 'purchase.receive'] });
    expect(keeper).toMatchObject({
      canReceive: true,
      canCreate: false,
      canConfirm: false,
      canCancel: false,
      canSetPaidBy: false,
      canManageSuppliers: false,
      canSeeCost: false,
    });
  });

  it('thao tác trên đơn cần kèm quyền xem đơn', () => {
    expect(purchaseAccessFor({ role: 'Staff', permissions: ['purchase.confirm'] }).canConfirm).toBe(false);
  });
});

describe('lockedByPaidBy', () => {
  it('đơn do cổ đông chi hộ khoá sửa / huỷ với người không có quyền ghi chi hộ', () => {
    const noPaidBy = purchaseAccessFor({ role: 'Staff', permissions: ['purchase.read', 'purchase.update'] });
    expect(lockedByPaidBy(noPaidBy, { paidByShareholderId: 's1' })).toBe(true);
    expect(lockedByPaidBy(noPaidBy, { paidByShareholderId: null })).toBe(false);
    expect(lockedByPaidBy(purchaseAccessFor({ role: 'Admin' }), { paidByShareholderId: 's1' })).toBe(false);
  });
});
