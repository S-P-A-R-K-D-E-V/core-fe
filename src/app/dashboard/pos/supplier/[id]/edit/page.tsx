import { PERMISSIONS } from 'src/auth/permissions';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import { SupplierEditView } from 'src/sections/pos/supplier/view';

export const metadata = { title: 'Sửa nhà cung cấp' };

type Props = { params: { id: string } };

export default function SupplierEditPage({ params }: Props) {
  return (
    <RoleBasedGuard hasContent allPermissions={[PERMISSIONS.supplier.manage]}>
      <SupplierEditView id={params.id} />
    </RoleBasedGuard>
  );
}
