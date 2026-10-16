import { useMemo } from 'react';

import { useAuthContext } from 'src/auth/hooks';
import { PERMISSIONS, hasPermission, hasAllPermissions } from 'src/auth/permissions';

// ----------------------------------------------------------------------
// Quyền ở mục Nhập hàng / Nhà cung cấp — khớp Core-be (purchase.*, supplier.*). Đơn do cổ đông chi hộ sinh giao dịch vốn:
// ghi / sửa / huỷ cần thêm purchase.paid-by.set (API trả 403 KiotVietPurchaseOrder.PaidByForbidden). Quyền thật do API
// quyết định.
// ----------------------------------------------------------------------

type AccessSource = Parameters<typeof hasAllPermissions>[0];

const P = PERMISSIONS.purchase;

export type PurchaseAccess = {
  canCreate: boolean;
  canUpdate: boolean;
  canConfirm: boolean;
  canReceive: boolean;
  canCancel: boolean;
  /** Chọn / đổi "ai chi hộ"; sửa, huỷ đơn đang do cổ đông chi hộ. */
  canSetPaidBy: boolean;
  canManageSuppliers: boolean;
  /** Tạo nhanh hàng hoá từ form nhập hàng. */
  canCreateProducts: boolean;
  canSeeCost: boolean;
};

export function purchaseAccessFor(user: AccessSource): PurchaseAccess {
  const can = (code: string) => hasAllPermissions(user, [P.read, code]);
  return {
    canCreate: can(P.create),
    canUpdate: can(P.update),
    canConfirm: can(P.confirm),
    canReceive: can(P.receive),
    canCancel: can(P.cancel),
    canSetPaidBy: can(P.paidBySet),
    canManageSuppliers: hasAllPermissions(user, [PERMISSIONS.supplier.read, PERMISSIONS.supplier.manage]),
    canCreateProducts: hasAllPermissions(user, [PERMISSIONS.products.create, PERMISSIONS.products.costRead]),
    canSeeCost: hasPermission(user, PERMISSIONS.products.costRead),
  };
}

export function usePurchaseAccess(): PurchaseAccess {
  const { user } = useAuthContext();
  return useMemo(() => purchaseAccessFor(user), [user]);
}

/** Đơn đang do cổ đông chi hộ mà người hiện tại không có quyền ghi chi hộ → không sửa, huỷ được. */
export function lockedByPaidBy(
  access: PurchaseAccess,
  order: { paidByShareholderId?: string | null } | null | undefined
): boolean {
  return !access.canSetPaidBy && !!order?.paidByShareholderId;
}
