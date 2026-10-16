import PlatformFeatureGuard from 'src/auth/guard/platform-feature-guard';
import { PLATFORM_FEATURES } from 'src/auth/platform-features';

import { AttendanceCheckinView } from 'src/sections/attendance/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Check In/Out',
};

export default function AttendanceCheckinPage() {
  return (
    <PlatformFeatureGuard feature={PLATFORM_FEATURES.selfCheckIn} label="Chấm công">
      <AttendanceCheckinView />
    </PlatformFeatureGuard>
  );
}
