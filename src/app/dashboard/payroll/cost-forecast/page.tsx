import PlatformFeatureGuard from 'src/auth/guard/platform-feature-guard';
import { PLATFORM_FEATURES } from 'src/auth/platform-features';

import { CostForecastView } from 'src/sections/payroll/cost-forecast-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Chi phí dự kiến',
};

export default function CostForecastPage() {
  return (
    <PlatformFeatureGuard feature={PLATFORM_FEATURES.payroll} label="Lương">
      <CostForecastView />
    </PlatformFeatureGuard>
  );
}
