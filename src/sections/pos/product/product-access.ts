import { useMemo } from 'react';

import { useAuthContext } from 'src/auth/hooks';
import { PERMISSIONS, hasAllPermissions } from 'src/auth/permissions';

import { useCounterSession } from 'src/sections/counter/counter-scope';

// ----------------------------------------------------------------------
// Quyền ở danh sách hàng hoá — khớp Core-be ProductsController: xem hàng mở cho mọi nhân viên; thêm / sửa cần kèm
// products.cost.read (form gửi cả giá vốn). Máy quầy chỉ xem hàng + in tem (server cũng chặn). Quyền thật do API quyết định.
// ----------------------------------------------------------------------

type AccessSource = Parameters<typeof hasAllPermissions>[0];

const P = PERMISSIONS.products;

export type ProductAccess = {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export function productAccessFor(user: AccessSource, counterSession: boolean): ProductAccess {
  const can = (codes: string[]) => !counterSession && hasAllPermissions(user, codes);
  return {
    canCreate: can([P.create, P.costRead]),
    canUpdate: can([P.update, P.costRead]),
    canDelete: can([P.delete]),
  };
}

export function useProductAccess(): ProductAccess {
  const { user } = useAuthContext();
  const counterSession = useCounterSession();
  return useMemo(() => productAccessFor(user, counterSession), [user, counterSession]);
}
