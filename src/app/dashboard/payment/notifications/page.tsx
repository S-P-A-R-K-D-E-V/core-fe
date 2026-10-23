import { redirect } from 'next/navigation';

import { paymentSettingsHref } from 'src/sections/payment/payment-pages';

// Trang cũ — đã gộp vào Thanh toán → Cài đặt → Báo có & kết nối.
export default function PaymentNotificationsPage() {
  redirect(paymentSettingsHref('connections'));
}
