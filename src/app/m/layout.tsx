import type { Metadata } from 'next';

import MobileLinkGuard from 'src/sections/agent-admin-link/mobile-link-guard';

// ----------------------------------------------------------------------
// /m/*: trang trung gian mở từ link trong tin nhắn ngoài (Zalo Bot báo việc agent — A3). Cần đăng nhập, không khung
// dashboard, không lập chỉ mục.
// ----------------------------------------------------------------------

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = {
  children: React.ReactNode;
};

export default function MobileLinkLayout({ children }: Props) {
  return <MobileLinkGuard>{children}</MobileLinkGuard>;
}
