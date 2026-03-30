import { SalesOrderEditView } from 'src/sections/pos/sales-order/view';

export const metadata = { title: 'Chỉnh sửa đơn bán hàng' };

type Props = { params: { id: string } };

export default function SalesOrderEditPage({ params }: Props) {
  return <SalesOrderEditView id={params.id} />;
}
