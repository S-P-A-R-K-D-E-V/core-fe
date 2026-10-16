import PlatformFeatureGuard from 'src/auth/guard/platform-feature-guard';
import { PLATFORM_FEATURES } from 'src/auth/platform-features';

import { ShiftCashDashboardView } from 'src/sections/shift-cash/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Kiểm tiền quầy',
};

export default function ShiftCashPage() {
  return (
    <PlatformFeatureGuard feature={PLATFORM_FEATURES.shiftCash} label="Kiểm quầy">
      <ShiftCashDashboardView />
    </PlatformFeatureGuard>
  );
}
