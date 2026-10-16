import RoleBasedGuard from 'src/auth/guard/role-based-guard';
import { PLATFORM_FEATURES } from 'src/auth/platform-features';
import PlatformFeatureGuard from 'src/auth/guard/platform-feature-guard';

import { REPORT_VIEW_PERMISSIONS } from 'src/sections/pos/report/report-access';

// ----------------------------------------------------------------------
// Báo cáo kinh doanh (/dashboard/pos/report/*): theo quyền analytics.* (Core-be /reports/*). Chủ cửa hàng có đủ; vai
// trò tuỳ chỉnh (vd "Kế toán") được cấp từng báo cáo — mỗi trang tự chặn thêm theo quyền của nó. Chủ cửa hàng còn có thể
// tắt xem báo cáo trên web với từng vai trò (Tính năng web / app).

type Props = {
  children: React.ReactNode;
};

export default function ReportLayout({ children }: Props) {
  return (
    <RoleBasedGuard hasContent permissions={REPORT_VIEW_PERMISSIONS}>
      <PlatformFeatureGuard feature={PLATFORM_FEATURES.reports} label="Xem báo cáo kinh doanh">
        {children}
      </PlatformFeatureGuard>
    </RoleBasedGuard>
  );
}
