import { HrContractsView } from 'src/sections/hr/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Hợp đồng lao động',
};

type Props = { searchParams?: { tab?: string } };

export default function HrContractsPage({ searchParams }: Props) {
  return <HrContractsView initialTab={searchParams?.tab} />;
}
