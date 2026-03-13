import { CategoryEditView } from 'src/sections/pos/category/view';

export const metadata = { title: 'Sửa danh mục' };

type Props = { params: { id: string } };

export default function CategoryEditPage({ params }: Props) {
  return <CategoryEditView id={params.id} />;
}
