import { HrTasksView } from 'src/sections/hr/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Nhiệm vụ',
};

type Props = { searchParams?: { tab?: string } };

export default function HrTasksPage({ searchParams }: Props) {
  return <HrTasksView initialTab={searchParams?.tab} />;
}
