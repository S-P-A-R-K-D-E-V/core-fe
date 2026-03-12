import { ShiftScheduleEditView } from 'src/sections/shift/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Edit Shift Schedule',
};

type Props = {
  params: { id: string };
};

export default function ShiftScheduleEditPage({ params }: Props) {
  const { id } = params;

  return <ShiftScheduleEditView id={id} />;
}
