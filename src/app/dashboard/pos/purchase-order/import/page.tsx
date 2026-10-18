import { PERMISSIONS } from 'src/auth/permissions';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import { PurchaseImportListView } from 'src/sections/pos/purchase-import/view';

export const metadata = { title: 'Nhập từ ảnh hoá đơn' };

export default function PurchaseImportPage() {
  return (
    <RoleBasedGuard hasContent allPermissions={[PERMISSIONS.purchase.create]}>
      <PurchaseImportListView />
    </RoleBasedGuard>
  );
}
