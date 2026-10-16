import PlatformFeatureGuard from 'src/auth/guard/platform-feature-guard';
import { PLATFORM_FEATURES } from 'src/auth/platform-features';

import { ShiftCashMonthlyView } from 'src/sections/shift-cash/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Thu chi quầy theo tháng',
};

export default function ShiftCashMonthlyPage() {
  return (
    <PlatformFeatureGuard feature={PLATFORM_FEATURES.shiftCash} label="Kiểm quầy">
      <ShiftCashMonthlyView />
    </PlatformFeatureGuard>
  );
}
