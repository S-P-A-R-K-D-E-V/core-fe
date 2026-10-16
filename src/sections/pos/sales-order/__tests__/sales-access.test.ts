import { describe, expect, it } from 'vitest';

import { salesAccessFor } from '../sales-access';

// ----------------------------------------------------------------------
// Hoá đơn / khách hàng theo quyền sales.* / sales-return.* / customer.* (Core-be). Máy quầy: xem mọi hoá đơn, trả hàng
// (OrCounter) nhưng không sửa / huỷ hoá đơn, không xoá khách.
// ----------------------------------------------------------------------

const MANAGER_DEFAULTS = [
  'sales.order.read',
  'sales.order.update',
  'sales.order.cancel',
  'sales-return.read',
  'sales-return.create',
  'sales-return.complete',
  'customer.read',
  'customer.manage',
  'customer.delete',
];

describe('salesAccessFor', () => {
  it('Manager mặc định: mọi việc trừ xuất Excel (chỉ Admin)', () => {
    expect(salesAccessFor({ role: 'Manager', permissions: MANAGER_DEFAULTS }, false)).toEqual({
      seesAllOrders: true,
      canExport: false,
      canUpdate: true,
      canCancel: true,
      canReturn: true,
      canManageCustomers: true,
      canDeleteCustomers: true,
    });
    expect(salesAccessFor({ role: 'Admin' }, false).canExport).toBe(true);
  });

  it('nhân viên thường: chỉ hoá đơn của mình, không trả hàng, không sửa khách', () => {
    expect(salesAccessFor({ role: 'Staff', permissions: [] }, false)).toEqual({
      seesAllOrders: false,
      canExport: false,
      canUpdate: false,
      canCancel: false,
      canReturn: false,
      canManageCustomers: false,
      canDeleteCustomers: false,
    });
  });

  it('máy quầy: xem mọi hoá đơn, trả hàng; không sửa / huỷ hoá đơn, không xoá khách — kể cả chủ', () => {
    const counterStaff = salesAccessFor({ role: 'Staff', permissions: [] }, true);
    expect(counterStaff).toMatchObject({ seesAllOrders: true, canReturn: true, canUpdate: false, canCancel: false });
    expect(salesAccessFor({ role: 'Admin' }, true)).toMatchObject({ canUpdate: false, canCancel: false, canDeleteCustomers: false });
  });

  it('trả hàng ngoài máy quầy cần cả lập lẫn hoàn tất phiếu', () => {
    expect(
      salesAccessFor({ role: 'Staff', permissions: ['sales-return.read', 'sales-return.create'] }, false).canReturn
    ).toBe(false);
  });
});
