import PlatformFeatureGuard from 'src/auth/guard/platform-feature-guard';
import { PLATFORM_FEATURES } from 'src/auth/platform-features';

import { PayrollComplaintsView } from 'src/sections/payroll/payroll-complaints';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Khiếu nại phiếu lương',
};

export default function PayrollComplaintsPage() {
  return (
    <PlatformFeatureGuard feature={PLATFORM_FEATURES.payroll} label="Lương">
      <PayrollComplaintsView />
    </PlatformFeatureGuard>
  );
}
