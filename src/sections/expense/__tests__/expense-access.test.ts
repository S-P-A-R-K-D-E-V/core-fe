import { describe, expect, it } from 'vitest';

import { expenseAccessFor, lockedByShareholderFunds } from 'src/sections/expense/expense-access';

// ----------------------------------------------------------------------
// Khớp Core-be ExpensesController: ghi cần quyền riêng + quyền xem; chi hộ cổ đông chỉ chủ cửa hàng.
// ----------------------------------------------------------------------

describe('expenseAccessFor', () => {
  it('chủ cửa hàng làm được mọi thứ, kể cả chi hộ cổ đông', () => {
    const access = expenseAccessFor({ role: 'Admin', roles: ['Admin'] });
    expect(Object.values(access).every(Boolean)).toBe(true);
  });

  it('vai trò tuỳ chỉnh: đúng quyền được cấp, không đụng chi hộ cổ đông', () => {
    const access = expenseAccessFor({
      role: 'Staff',
      roles: ['Staff'],
      permissions: ['expense.read', 'expense.create'],
    });
    expect(access).toEqual({
      canCreate: true,
      canUpdate: false,
      canDelete: false,
      canManageCategories: false,
      canManageRecurring: false,
      canManageShareholderFunds: false,
    });
  });

  it('thiếu quyền xem thì không ghi được (API chặn ở class)', () => {
    expect(expenseAccessFor({ role: 'Manager', permissions: ['expense.update'] }).canUpdate).toBe(
      false
    );
  });

  it('khoá khoản chi hộ với người không phải chủ', () => {
    const staff = expenseAccessFor({
      role: 'Staff',
      permissions: ['expense.read', 'expense.update'],
    });
    const owner = expenseAccessFor({ role: 'Admin' });
    expect(lockedByShareholderFunds(staff, { paidByShareholderId: 's1' })).toBe(true);
    expect(lockedByShareholderFunds(staff, { paidByShareholderId: null })).toBe(false);
    expect(lockedByShareholderFunds(owner, { paidByShareholderId: 's1' })).toBe(false);
  });
});
