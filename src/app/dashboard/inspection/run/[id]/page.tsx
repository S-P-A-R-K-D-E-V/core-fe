import { InspectionRunView } from 'src/sections/inspection/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Lượt kiểm',
};

type Props = {
  params: {
    id: string;
  };
};

export default function InspectionRunPage({ params }: Props) {
  return <InspectionRunView id={params.id} />;
}
