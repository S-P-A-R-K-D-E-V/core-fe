import { PERMISSIONS } from 'src/auth/permissions';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import { ExpenseCreateView } from 'src/sections/expense/view';

export const metadata = { title: 'Thêm chi phí' };

export default function ExpenseCreatePage() {
  return (
    <RoleBasedGuard hasContent allPermissions={[PERMISSIONS.expense.create]}>
      <ExpenseCreateView />
    </RoleBasedGuard>
  );
}
