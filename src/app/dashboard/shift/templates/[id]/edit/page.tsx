import { ShiftTemplateEditView } from 'src/sections/shift/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Edit Shift Template',
};

type Props = {
  params: { id: string };
};

export default function ShiftTemplateEditPage({ params }: Props) {
  const { id } = params;

  return <ShiftTemplateEditView id={id} />;
}
