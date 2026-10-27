import { HrPerformanceView } from 'src/sections/hr/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Điểm & xếp loại',
};

type Props = { searchParams?: { tab?: string } };

export default function HrPerformancePage({ searchParams }: Props) {
  return <HrPerformanceView initialTab={searchParams?.tab} />;
}
