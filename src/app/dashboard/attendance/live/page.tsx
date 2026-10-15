import FeatureGuard from 'src/auth/guard/feature-guard';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';
import { AttendanceLiveView } from 'src/sections/attendance-live/view/attendance-live-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Chấm công trực tiếp',
};

export default function AttendanceLivePage() {
  return (
    <RoleBasedGuard hasContent roles={['Admin']}>
      <FeatureGuard feature="store.camera">
        <AttendanceLiveView />
      </FeatureGuard>
    </RoleBasedGuard>
  );
}
