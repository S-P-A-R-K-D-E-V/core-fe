import { HrRecordsView } from 'src/sections/hr/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Biên bản',
};

type Props = { searchParams?: { tab?: string } };

export default function HrRecordsPage({ searchParams }: Props) {
  return <HrRecordsView initialTab={searchParams?.tab} />;
}
