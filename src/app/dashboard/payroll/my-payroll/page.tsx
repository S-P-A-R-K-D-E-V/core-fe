import PlatformFeatureGuard from 'src/auth/guard/platform-feature-guard';
import { PLATFORM_FEATURES } from 'src/auth/platform-features';

import MyPayrollView from 'src/sections/payroll/view/my-payroll-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Phiếu lương của tôi',
};

export default function MyPayrollPage() {
  return (
    <PlatformFeatureGuard feature={PLATFORM_FEATURES.payrollSelf} label="Xem lương của mình">
      <MyPayrollView />
    </PlatformFeatureGuard>
  );
}
