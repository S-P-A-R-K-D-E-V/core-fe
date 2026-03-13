import { WarehouseEditView } from 'src/sections/pos/warehouse/view';

export const metadata = { title: 'Sửa kho' };

type Props = { params: { id: string } };

export default function WarehouseEditPage({ params }: Props) {
  return <WarehouseEditView id={params.id} />;
}
