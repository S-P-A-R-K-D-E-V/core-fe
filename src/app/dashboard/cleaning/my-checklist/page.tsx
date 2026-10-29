import PlatformFeatureGuard from 'src/auth/guard/platform-feature-guard';
import { PLATFORM_FEATURES } from 'src/auth/platform-features';

import { CleaningMyChecklistView } from 'src/sections/cleaning/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Việc của tôi',
};

export default function CleaningMyChecklistPage() {
  return (
    <PlatformFeatureGuard feature={PLATFORM_FEATURES.cleaningTasks} label="Làm việc được giao">
      <CleaningMyChecklistView />
    </PlatformFeatureGuard>
  );
}
