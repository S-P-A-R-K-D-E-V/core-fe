import { SocialPostEditView } from 'src/sections/social/social-post-edit-view';

// ----------------------------------------------------------------------

export const metadata = { title: 'Sửa bài bán hàng' };

type Props = { params: { id: string } };

export default function SocialPostEditPage({ params }: Props) {
  return <SocialPostEditView id={params.id} />;
}
