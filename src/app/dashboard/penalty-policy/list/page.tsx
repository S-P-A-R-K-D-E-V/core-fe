import PlatformFeatureGuard from 'src/auth/guard/platform-feature-guard';
import { PLATFORM_FEATURES } from 'src/auth/platform-features';

import PenaltyPolicyListView from 'src/sections/penalty-policy/view/penalty-policy-list-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Quản lý chính sách chế tài',
};

export default function PenaltyPolicyListPage() {
  return (
    <PlatformFeatureGuard feature={PLATFORM_FEATURES.payroll} label="Xem bảng lương">
      <PenaltyPolicyListView />
    </PlatformFeatureGuard>
  );
}
