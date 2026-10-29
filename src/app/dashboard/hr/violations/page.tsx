import { HrViolationsView } from 'src/sections/hr/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Vi phạm & điểm trừ',
};

type Props = { searchParams?: { tab?: string } };

export default function HrViolationsPage({ searchParams }: Props) {
  return <HrViolationsView initialTab={searchParams?.tab} />;
}
