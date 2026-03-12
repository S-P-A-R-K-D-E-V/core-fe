// ⚠️ DEPRECATED: Use /dashboard/shift/schedules/new instead
// This route is kept for backward compatibility
import { ShiftScheduleCreateView } from 'src/sections/shift/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Create Shift (Deprecated)',
};

export default function ShiftCreatePage() {
  return <ShiftScheduleCreateView />;
}
