import PlatformFeatureGuard from 'src/auth/guard/platform-feature-guard';
import { PLATFORM_FEATURES } from 'src/auth/platform-features';

import SalaryHistoryView from 'src/sections/salary-history/view/salary-history-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Lịch sử thay đổi lương',
};

export default function SalaryHistoryPage() {
  return (
    <PlatformFeatureGuard feature={PLATFORM_FEATURES.payroll} label="Xem bảng lương">
      <SalaryHistoryView />
    </PlatformFeatureGuard>
  );
}
