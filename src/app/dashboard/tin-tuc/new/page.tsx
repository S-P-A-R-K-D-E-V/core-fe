import { StoreNewsEditView } from 'src/sections/store-news/store-news-edit-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Viết bài mới',
};

export default function StoreNewsCreatePage() {
  return <StoreNewsEditView id={null} />;
}
