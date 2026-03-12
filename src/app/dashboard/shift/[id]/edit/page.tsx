// ⚠️ DEPRECATED: Use /dashboard/shift/schedules/{id}/edit instead
// This route is kept for backward compatibility
import { ShiftScheduleEditView } from 'src/sections/shift/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Edit Shift (Deprecated)',
};

type Props = {
  params: {
    id: string;
  };
};

export default function ShiftEditPage({ params }: Props) {
  const { id } = params;

  return <ShiftScheduleEditView id={id} />;
}
