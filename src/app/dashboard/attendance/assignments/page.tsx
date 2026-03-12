// Updated to use V2 with ShiftSchedule
import { AttendanceAssignmentsViewV2 } from 'src/sections/attendance/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Shift Assignments',
};

export default function AttendanceAssignmentsPage() {
  return <AttendanceAssignmentsViewV2 />;
}
