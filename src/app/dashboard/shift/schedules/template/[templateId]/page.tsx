import { ShiftScheduleListView } from 'src/sections/shift/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Schedules by Template',
};

type Props = {
  params: { templateId: string };
};

export default function ShiftSchedulesByTemplatePage({ params }: Props) {
  const { templateId } = params;

  // Pass templateId to filter schedules by template
  // You can enhance ShiftScheduleListView to accept templateId as prop
  return <ShiftScheduleListView />;
}
