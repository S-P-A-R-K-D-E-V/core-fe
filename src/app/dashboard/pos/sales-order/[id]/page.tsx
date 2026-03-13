import { SalesOrderDetailView } from 'src/sections/pos/sales-order/view';

export const metadata = { title: 'Chi tiết đơn bán hàng' };

type Props = { params: { id: string } };

export default function SalesOrderDetailPage({ params }: Props) {
  return <SalesOrderDetailView id={params.id} />;
}
