import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import { REPORT_VIEW_PERMISSIONS } from 'src/sections/pos/report/report-access';

// ----------------------------------------------------------------------
// Báo cáo kinh doanh (/dashboard/pos/report/*): theo quyền analytics.* (Core-be /reports/*). Chủ cửa hàng có đủ; vai
// trò tuỳ chỉnh (vd "Kế toán") được cấp từng báo cáo — mỗi trang tự chặn thêm theo quyền của nó.

type Props = {
  children: React.ReactNode;
};

export default function ReportLayout({ children }: Props) {
  return (
    <RoleBasedGuard hasContent permissions={REPORT_VIEW_PERMISSIONS}>
      {children}
    </RoleBasedGuard>
  );
}
