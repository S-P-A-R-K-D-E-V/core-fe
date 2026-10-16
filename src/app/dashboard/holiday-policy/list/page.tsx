import PlatformFeatureGuard from 'src/auth/guard/platform-feature-guard';
import { PLATFORM_FEATURES } from 'src/auth/platform-features';

import HolidayPolicyListView from 'src/sections/holiday-policy/view/holiday-policy-list-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Quản lý chính sách ngày lễ',
};

export default function HolidayPolicyListPage() {
  return (
    <PlatformFeatureGuard feature={PLATFORM_FEATURES.payroll} label="Xem bảng lương">
      <HolidayPolicyListView />
    </PlatformFeatureGuard>
  );
}
