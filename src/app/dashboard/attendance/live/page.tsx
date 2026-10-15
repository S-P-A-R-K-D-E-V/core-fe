import FeatureGuard from 'src/auth/guard/feature-guard';
import { AttendanceLiveView } from 'src/sections/attendance-live/view/attendance-live-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Chấm công trực tiếp',
};

export default function AttendanceLivePage() {
  return (
    <FeatureGuard feature="store.camera">
      <AttendanceLiveView />
    </FeatureGuard>
  );
}
