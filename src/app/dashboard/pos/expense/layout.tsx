import { PERMISSIONS } from 'src/auth/permissions';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';

// ----------------------------------------------------------------------
// Mọi trang chi phí cần quyền xem (Core-be ExpensesController: [RequirePermission(expense.read)] ở class) — chặn trước
// khi trang gọi API. Trang thêm / sửa cần thêm quyền riêng (guard ở page).
// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
};

export default function ExpenseLayout({ children }: Props) {
  return (
    <RoleBasedGuard hasContent permissions={[PERMISSIONS.expense.read]}>
      {children}
    </RoleBasedGuard>
  );
}
