// ⚠️ DEPRECATED: Use /dashboard/shift/schedules instead
// This route is kept for backward compatibility
import { ShiftScheduleListView } from 'src/sections/shift/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Shift List (Deprecated)',
};

export default function ShiftListPage() {
  return <ShiftScheduleListView />;
}
