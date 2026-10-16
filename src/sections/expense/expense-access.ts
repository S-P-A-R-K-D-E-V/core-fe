import { useMemo } from 'react';

import { useAuthContext } from 'src/auth/hooks';
import { hasAnyRole, ADMIN_ROLES, getUserRoles } from 'src/auth/roles';
import { PERMISSIONS, hasAllPermissions } from 'src/auth/permissions';

// ----------------------------------------------------------------------
// Quyền ở mục Chi phí — khớp Core-be ExpensesController: mọi thao tác cần expense.read, thao tác ghi cần thêm quyền riêng.
// Chi phí do cổ đông chi hộ (sinh giao dịch vốn, ảnh hưởng chốt sổ) chỉ chủ cửa hàng tạo / sửa / xoá / tắt, kể cả khi vai
// trò tuỳ chỉnh có quyền ghi (403 Expense.ShareholderFundsOwnerOnly). Quyền thật do API quyết định.
// ----------------------------------------------------------------------

type AccessSource = Parameters<typeof hasAllPermissions>[0];

const P = PERMISSIONS.expense;

export type ExpenseAccess = {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canManageCategories: boolean;
  canManageRecurring: boolean;
  /** Chọn "ai chi hộ", sửa / xoá khoản đang do cổ đông chi hộ. */
  canManageShareholderFunds: boolean;
};

export function expenseAccessFor(user: AccessSource): ExpenseAccess {
  const can = (code: string) => hasAllPermissions(user, [P.read, code]);
  return {
    canCreate: can(P.create),
    canUpdate: can(P.update),
    canDelete: can(P.delete),
    canManageCategories: can(P.categoryManage),
    canManageRecurring: can(P.recurringManage),
    canManageShareholderFunds: hasAnyRole(getUserRoles(user), ADMIN_ROLES),
  };
}

export function useExpenseAccess(): ExpenseAccess {
  const { user } = useAuthContext();
  return useMemo(() => expenseAccessFor(user), [user]);
}

/** Khoản chi / chi phí định kỳ đang do cổ đông chi hộ mà người hiện tại không phải chủ cửa hàng → không sửa, xoá được. */
export function lockedByShareholderFunds(
  access: ExpenseAccess,
  item: { paidByShareholderId?: string | null } | null | undefined
): boolean {
  return !access.canManageShareholderFunds && !!item?.paidByShareholderId;
}

export const SHAREHOLDER_FUNDS_LOCKED_TEXT =
  'Khoản do cổ đông chi hộ — chỉ chủ cửa hàng sửa, xoá được';
