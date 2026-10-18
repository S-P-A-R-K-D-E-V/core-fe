import { PERMISSIONS } from 'src/auth/permissions';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import { PurchaseImportReviewView } from 'src/sections/pos/purchase-import/view';

export const metadata = { title: 'Duyệt hoá đơn nhập' };

type Props = { params: { id: string } };

export default function PurchaseImportReviewPage({ params }: Props) {
  return (
    <RoleBasedGuard hasContent allPermissions={[PERMISSIONS.purchase.create]}>
      <PurchaseImportReviewView id={params.id} />
    </RoleBasedGuard>
  );
}
