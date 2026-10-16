import PlatformFeatureGuard from 'src/auth/guard/platform-feature-guard';
import { PLATFORM_FEATURES } from 'src/auth/platform-features';

import SalaryConfigurationView from 'src/sections/salary/view/salary-configuration-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Cấu hình lương',
};

export default function SalaryConfigurationPage() {
  return (
    <PlatformFeatureGuard feature={PLATFORM_FEATURES.payroll} label="Xem bảng lương">
      <SalaryConfigurationView />
    </PlatformFeatureGuard>
  );
}
