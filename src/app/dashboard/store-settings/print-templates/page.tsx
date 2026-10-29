import { PERMISSIONS } from 'src/auth/permissions';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import { PrintTemplateListView } from 'src/sections/print-template/view/print-template-list-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Mẫu in',
};

// Mẫu in hoá đơn / tem mã + mẫu áp dụng theo kênh × phương thức — quyền sales.print-template.manage (Admin, Manager).
export default function PrintTemplatesPage() {
  return (
    <RoleBasedGuard hasContent permissions={[PERMISSIONS.sales.printTemplateManage]}>
      <PrintTemplateListView />
    </RoleBasedGuard>
  );
}
