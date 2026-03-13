import { ProductEditView } from 'src/sections/pos/product/view';

export const metadata = { title: 'Sửa sản phẩm' };

type Props = { params: { id: string } };

export default function ProductEditPage({ params }: Props) {
  return <ProductEditView id={params.id} />;
}
