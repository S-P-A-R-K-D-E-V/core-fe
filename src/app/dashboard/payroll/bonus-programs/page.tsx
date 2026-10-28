import PlatformFeatureGuard from 'src/auth/guard/platform-feature-guard';
import { PLATFORM_FEATURES } from 'src/auth/platform-features';

import { BonusProgramsView } from 'src/sections/payroll/bonus-programs-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Chương trình thưởng',
};

export default function BonusProgramsPage() {
  return (
    <PlatformFeatureGuard feature={PLATFORM_FEATURES.payroll} label="Lương">
      <BonusProgramsView />
    </PlatformFeatureGuard>
  );
}
