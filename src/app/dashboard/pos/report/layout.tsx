import RoleBasedGuard from 'src/auth/guard/role-based-guard';

// ----------------------------------------------------------------------
// Báo cáo kinh doanh (/dashboard/pos/report/*): chỉ chủ cửa hàng — quản lý / nhân viên không xem.

type Props = {
  children: React.ReactNode;
};

export default function ReportLayout({ children }: Props) {
  return (
    <RoleBasedGuard hasContent roles={['Admin']}>
      {children}
    </RoleBasedGuard>
  );
}
