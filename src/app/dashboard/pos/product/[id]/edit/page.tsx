import { PERMISSIONS } from 'src/auth/permissions';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import { ProductEditView } from 'src/sections/pos/product/view';

export const metadata = { title: 'Sửa sản phẩm' };

type Props = { params: { id: string } };

export default function ProductEditPage({ params }: Props) {
  return (
    <RoleBasedGuard hasContent allPermissions={[PERMISSIONS.products.update]}>
      <ProductEditView id={params.id} />
    </RoleBasedGuard>
  );
}
