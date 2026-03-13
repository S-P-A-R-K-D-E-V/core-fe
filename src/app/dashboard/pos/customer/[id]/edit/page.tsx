import { CustomerEditView } from 'src/sections/pos/customer/view';

export const metadata = { title: 'Sửa khách hàng' };

type Props = { params: { id: string } };

export default function CustomerEditPage({ params }: Props) {
  return <CustomerEditView id={params.id} />;
}
