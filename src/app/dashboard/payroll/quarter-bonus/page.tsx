import PlatformFeatureGuard from 'src/auth/guard/platform-feature-guard';
import { PLATFORM_FEATURES } from 'src/auth/platform-features';

import { QuarterBonusView } from 'src/sections/payroll/quarter-bonus-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Thưởng quý',
};

export default function QuarterBonusPage() {
  return (
    <PlatformFeatureGuard feature={PLATFORM_FEATURES.payroll} label="Lương">
      <QuarterBonusView />
    </PlatformFeatureGuard>
  );
}
