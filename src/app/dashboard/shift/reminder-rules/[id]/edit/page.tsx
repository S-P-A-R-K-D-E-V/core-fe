import { ShiftReminderRuleEditView } from 'src/sections/shift-reminder-rule/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Edit Shift Reminder Rule',
};

type Props = {
  params: { id: string };
};

export default function ShiftReminderRuleEditPage({ params }: Props) {
  const { id } = params;

  return <ShiftReminderRuleEditView id={id} />;
}
