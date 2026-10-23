import type { Metadata } from 'next';

import { CheckoutView } from 'src/sections/checkout/view';

// ----------------------------------------------------------------------
// Đặt hàng online — khách không cần đăng nhập (đơn + thanh toán qua /public/storefront/*). Không lập chỉ mục.

export const metadata: Metadata = {
  title: 'Đặt hàng',
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return <CheckoutView />;
}
