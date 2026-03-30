import { PurchaseOrderEditView } from 'src/sections/pos/purchase-order/view';

export const metadata = { title: 'Sửa đơn nhập hàng' };

type Props = { params: { id: string } };

export default function PurchaseOrderEditPage({ params }: Props) {
  return <PurchaseOrderEditView id={params.id} />;
}
