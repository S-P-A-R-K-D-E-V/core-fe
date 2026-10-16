import { PERMISSIONS } from 'src/auth/permissions';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import { PurchaseOrderEditView } from 'src/sections/pos/purchase-order/view';

export const metadata = { title: 'Sửa đơn nhập hàng' };

type Props = { params: { id: string } };

export default function PurchaseOrderEditPage({ params }: Props) {
  return (
    <RoleBasedGuard hasContent allPermissions={[PERMISSIONS.purchase.update]}>
      <PurchaseOrderEditView id={params.id} />
    </RoleBasedGuard>
  );
}
