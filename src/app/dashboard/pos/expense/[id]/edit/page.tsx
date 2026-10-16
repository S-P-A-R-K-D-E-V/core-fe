import { PERMISSIONS } from 'src/auth/permissions';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import { ExpenseEditView } from 'src/sections/expense/view';

export const metadata = { title: 'Sửa chi phí' };

type Props = { params: { id: string } };

export default function ExpenseEditPage({ params }: Props) {
  return (
    <RoleBasedGuard hasContent allPermissions={[PERMISSIONS.expense.update]}>
      <ExpenseEditView id={params.id} />
    </RoleBasedGuard>
  );
}
