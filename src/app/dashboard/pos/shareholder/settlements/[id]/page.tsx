import { SettlementDetailView } from 'src/sections/shareholder/view';

export const metadata = { title: 'Chi tiết kỳ chốt sổ' };

type Props = { params: { id: string } };

export default function SettlementDetailPage({ params }: Props) {
  return <SettlementDetailView id={params.id} />;
}
