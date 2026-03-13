import { SupplierEditView } from 'src/sections/pos/supplier/view';

export const metadata = { title: 'Sửa nhà cung cấp' };

type Props = { params: { id: string } };

export default function SupplierEditPage({ params }: Props) {
  return <SupplierEditView id={params.id} />;
}
