import { StoreNewsEditView } from 'src/sections/store-news/store-news-edit-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Sửa bài viết',
};

type Props = {
  params: { id: string };
};

export default function StoreNewsEditPage({ params }: Props) {
  return <StoreNewsEditView id={params.id} />;
}
