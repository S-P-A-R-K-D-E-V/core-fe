import { useMemo } from 'react';

import { useAuthContext } from 'src/auth/hooks';
import { PERMISSIONS, hasPermission, hasAllPermissions } from 'src/auth/permissions';

import { useCounterSession } from 'src/sections/counter/counter-scope';

// ----------------------------------------------------------------------
// Quyền ở hoá đơn / khách hàng — khớp Core-be (sales.*, sales-return.*, customer.*). Phiên máy quầy: xem mọi hoá đơn, trả
// hàng theo hoá đơn, tra khách (server cho qua bằng OrCounter) nhưng không sửa / huỷ hoá đơn, không xoá khách. Quyền thật
// do API quyết định.
// ----------------------------------------------------------------------

type AccessSource = Parameters<typeof hasAllPermissions>[0];

const S = PERMISSIONS.sales;
const R = PERMISSIONS.salesReturn;
const C = PERMISSIONS.customer;

export type SalesAccess = {
  /** Mọi hoá đơn của cửa hàng (không có: chỉ hoá đơn mình bán hôm nay). */
  seesAllOrders: boolean;
  canExport: boolean;
  canUpdate: boolean;
  canCancel: boolean;
  /** Lập + hoàn tất phiếu trả hàng (hộp thoại trả hàng làm cả hai). */
  canReturn: boolean;
  canManageCustomers: boolean;
  canDeleteCustomers: boolean;
};

export function salesAccessFor(user: AccessSource, counterSession: boolean): SalesAccess {
  const office = (codes: string[]) => !counterSession && hasAllPermissions(user, codes);
  return {
    seesAllOrders: counterSession || hasPermission(user, S.orderRead),
    canExport: office([S.orderRead, S.orderExport]),
    canUpdate: office([S.orderRead, S.orderUpdate]),
    canCancel: office([S.orderRead, S.orderCancel]),
    canReturn: counterSession || hasAllPermissions(user, [R.read, R.create, R.complete]),
    canManageCustomers: hasAllPermissions(user, [C.read, C.manage]),
    canDeleteCustomers: office([C.read, C.delete]),
  };
}

export function useSalesAccess(): SalesAccess {
  const { user } = useAuthContext();
  const counterSession = useCounterSession();
  return useMemo(() => salesAccessFor(user, counterSession), [user, counterSession]);
}
