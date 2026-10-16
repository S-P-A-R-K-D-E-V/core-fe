import PlatformFeatureGuard from 'src/auth/guard/platform-feature-guard';
import { PLATFORM_FEATURES } from 'src/auth/platform-features';

import PayrollBatchView from 'src/sections/payroll/view/payroll-batch-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Bảng lương nhân viên',
};

export default function PayrollBatchPage() {
  return (
    <PlatformFeatureGuard feature={PLATFORM_FEATURES.payroll} label="Xem bảng lương">
      <PayrollBatchView />
    </PlatformFeatureGuard>
  );
}
