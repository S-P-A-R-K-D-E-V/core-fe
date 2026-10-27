import { HrLeaveView } from 'src/sections/hr/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Xin nghỉ ca',
};

type Props = { searchParams?: { tab?: string } };

export default function HrLeavePage({ searchParams }: Props) {
  return <HrLeaveView initialTab={searchParams?.tab} />;
}
