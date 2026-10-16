import PlatformFeatureGuard from 'src/auth/guard/platform-feature-guard';
import { PLATFORM_FEATURES } from 'src/auth/platform-features';

import PayrollCycleListView from 'src/sections/payroll-cycle/view/payroll-cycle-list-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Quản lý chu kỳ lương',
};

export default function PayrollCyclesPage() {
  return (
    <PlatformFeatureGuard feature={PLATFORM_FEATURES.payroll} label="Xem bảng lương">
      <PayrollCycleListView />
    </PlatformFeatureGuard>
  );
}
