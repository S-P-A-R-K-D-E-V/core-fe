import AttendanceCheckinView from 'src/sections/attendance/view/attendance-checkin-view';
import { OverviewAppView } from 'src/sections/overview/app/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: App',
};

export default function OverviewAppPage() {
  return <AttendanceCheckinView />;
}
