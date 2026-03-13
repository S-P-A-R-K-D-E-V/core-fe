import { PurchaseOrderDetailView } from 'src/sections/pos/purchase-order/view';

export const metadata = { title: 'Chi tiết đơn nhập hàng' };

type Props = { params: { id: string } };

export default function PurchaseOrderDetailPage({ params }: Props) {
  return <PurchaseOrderDetailView id={params.id} />;
}
