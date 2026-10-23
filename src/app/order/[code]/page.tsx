import type { Metadata } from 'next';

import OnlineOrderView from 'src/sections/online-order-public/online-order-view';

// ----------------------------------------------------------------------
// Trang đơn online của khách: /order/{mã}/?t={khoá} — link có khoá bí mật, không cần đăng nhập, không lập chỉ mục.

type Props = {
  params: { code: string };
};

export const metadata: Metadata = {
  title: 'Đơn hàng',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function OnlineOrderPage({ params }: Props) {
  return <OnlineOrderView code={decodeURIComponent(params.code)} />;
}
